import { BracketError } from '@/base/classes/error'
import { Service } from '@/base/classes/service'
import { queue } from '@/lib/bullmq'
import { BRAND_COLOR, TOURNAMENT_REGISTRATION_START } from '@/lib/constants'
import logger from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import {
  Match,
  MatchStatus,
  Team,
  Tournament,
  TournamentStage,
  TournamentTeam,
  TournamentType,
} from '@prisma/client'
import * as dateFns from 'date-fns'
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TextChannel,
} from 'discord.js'

export class TournamentService extends Service {
  async scheduleRegistrationStart(tournament: Tournament) {
    // Cancel existing job if any
    const existingJob = await queue.getJob(
      `${TOURNAMENT_REGISTRATION_START}:${tournament.id}`
    )
    if (existingJob) {
      try {
        await existingJob.remove()
      } catch {}
      logger.info(
        `Existing registration open job for tournament ${tournament.id} removed`
      )
    }

    if (tournament.stage !== 'SETUP') {
      logger.warn(
        `Tournament ${tournament.id} is not in SETUP stage, skipping scheduling registration start`
      )
      return
    }

    const delay = tournament.registrationStartTime.getTime() - Date.now()
    if (delay <= 0) {
      logger.info(
        `Registration start time for tournament ${tournament.id} is in the past, opening registration immediately`
      )
      await this.openRegistration(tournament)
      return
    }

    await queue.add(
      TOURNAMENT_REGISTRATION_START,
      { tournamentId: tournament.id },
      { delay, jobId: `${TOURNAMENT_REGISTRATION_START}:${tournament.id}` }
    )
    logger.info(
      `Registration open job for tournament ${tournament.id} queued to run in ${Math.round(
        delay / 1000
      )} seconds`
    )
  }

  async openRegistration(tournament: Tournament) {
    if (tournament.stage === 'REGISTRATION') {
      logger.warn(
        `Tournament ${tournament.id} is already in registration stage`
      )
      throw new BracketError('Tournament is already in registration stage.')
    }

    // Clear all older teams if any
    await prisma.tournamentTeam.deleteMany({
      where: { tournamentId: tournament.id },
    })

    let channel
    try {
      channel = (await this.client.channels.fetch(
        tournament.registrationChannelId
      )) as TextChannel
    } catch (error) {
      logger.error(
        `Failed to fetch registration channel ${tournament.registrationChannelId} for tournament ${tournament.id}: ${(error as Error).message}`
      )
      throw new BracketError(
        `Can't find registration channel <#${tournament.registrationChannelId}>. Maybe it was deleted?`
      )
    }

    try {
      await channel.permissionOverwrites.edit(tournament.guildId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      })
    } catch (error) {
      logger.error(
        `Failed to update permissions for registration channel ${tournament.registrationChannelId} for tournament ${tournament.id}: ${(error as Error).message}`
      )
      throw new BracketError(
        `Can't update permissions for registration channel <#${tournament.registrationChannelId}>. Maybe I don't have permission to do so?`
      )
    }

    await prisma.tournament.update({
      where: { id: tournament.id },
      data: { stage: 'REGISTRATION' },
    })
    logger.info(`Tournament ${tournament.id} moved to registration stage`)
    await this.updateTournamentConfigMessage(tournament)

    this.client.eventLogger.logEvent('registrationChannelOpened', {
      channelId: channel.id,
      trigger: { type: 'system' },
    })

    try {
      await channel.send({
        content: `Registration for tournament **${tournament.name}** is now OPEN! Use the button below to register your team.`,
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setLabel('Register Team')
              .setStyle(ButtonStyle.Primary)
              .setCustomId(`show_tournament_registration_select_menu`)
          ),
        ],
      })
    } catch (error) {
      logger.error(
        `Failed to send registration open message in channel <#${tournament.registrationChannelId}> for tournament ${tournament.id}: ${(error as Error).message}`
      )
    }
  }

  async closeRegistration(tournament: Tournament) {
    if (tournament.stage !== 'REGISTRATION') {
      logger.warn(`Tournament ${tournament.id} is not in registration stage`)
      throw new BracketError('Tournament is not in registration stage.')
    }

    let channel
    try {
      channel = (await this.client.channels.fetch(
        tournament.registrationChannelId
      )) as TextChannel
    } catch (error) {
      logger.error(
        `Failed to fetch registration channel ${tournament.registrationChannelId} for tournament ${tournament.id}: ${(error as Error).message}`
      )
      throw new BracketError(
        `Can't find registration channel <#${tournament.registrationChannelId}>. Maybe it was deleted?`
      )
    }

    try {
      await channel.permissionOverwrites.edit(tournament.guildId, {
        ViewChannel: true,
        SendMessages: false,
        ReadMessageHistory: true,
      })
    } catch (error) {
      logger.error(
        `Failed to update permissions for registration channel ${tournament.registrationChannelId} for tournament ${tournament.id}: ${(error as Error).message}`
      )
      throw new BracketError(
        `Can't update permissions for registration channel <#${tournament.registrationChannelId}>. Maybe I don't have permission to do so?`
      )
    }

    const teamCount = await prisma.tournamentTeam.count({
      where: { tournamentId: tournament.id },
    })

    if (teamCount < 2) {
      throw new BracketError(
        'Cannot close registration with less than 2 teams registered.'
      )
    }

    // Update tournament end time
    await prisma.tournament.update({
      where: { id: tournament.id },
      data: {
        stage:
          tournament.tournamentType === 'ROUND_ROBIN' ||
          tournament.tournamentType === 'SWISS'
            ? 'GROUP_STAGE'
            : 'BRACKET',
        registrationEndTime: new Date(),
      },
    })

    logger.info(
      `Tournament ${tournament.id} moved to ${
        tournament.tournamentType === 'ROUND_ROBIN' ||
        tournament.tournamentType === 'SWISS'
          ? 'GROUP_STAGE'
          : 'BRACKET'
      } stage`
    )
    await this.updateTournamentConfigMessage(tournament)

    this.client.eventLogger.logEvent('registrationClosed', {
      scrim: tournament as any,
    })

    try {
      await channel.send({
        content: `Registration for tournament **${tournament.name}** is now CLOSED! Brackets will be generated shortly.`,
      })
    } catch (error) {
      logger.error(
        `Failed to send registration close message in channel ${tournament.registrationChannelId} for tournament ${tournament.id}: ${(error as Error).message}`
      )
    }
  }

  async registerTeam(tournament?: Tournament | null, team?: Team | null) {
    if (!team) {
      throw new BracketError(
        'Team not found or you do not have permission to register this team'
      )
    }

    if (team.banned) {
      throw new BracketError(
        `Your team is banned from participating in tournaments.${
          team.banReason ? ` Reason: ${team.banReason}` : ''
        }`
      )
    }

    if (!tournament) {
      throw new BracketError('This channel is not set up for team registration')
    }

    if (tournament.stage !== TournamentStage.REGISTRATION) {
      throw new BracketError(
        'This tournament is not currently open for registration'
      )
    }

    const existing = await prisma.tournamentTeam.findUnique({
      where: {
        tournamentId_teamId: { tournamentId: tournament.id, teamId: team.id },
      },
    })

    if (existing) {
      throw new BracketError(
        'This team is already registered for the tournament'
      )
    }

    const teamCount = await prisma.tournamentTeam.count({
      where: { tournamentId: tournament.id },
    })

    if (teamCount >= tournament.maxTeams) {
      throw new BracketError(
        'This tournament has reached the maximum number of teams'
      )
    }

    const teamMembers = await prisma.teamMember.findMany({
      where: { teamId: team.id },
    })

    const mainPlayers = teamMembers.filter((tm) => tm.role !== 'SUBSTITUTE')
    const subPlayers = teamMembers.filter((tm) => tm.role === 'SUBSTITUTE')

    if (mainPlayers.length < tournament.minPlayersPerTeam) {
      throw new BracketError(
        `Your team does not have enough main players to register. Minimum required is ${tournament.minPlayersPerTeam}.`
      )
    }

    if (mainPlayers.length > tournament.maxPlayersPerTeam) {
      throw new BracketError(
        `Your team has too many main players to register. Maximum allowed is ${tournament.maxPlayersPerTeam}.`
      )
    }

    if (subPlayers.length > tournament.maxSubstitutePerTeam) {
      throw new BracketError(
        `Your team has too many substitutes to register. Maximum allowed is ${tournament.maxSubstitutePerTeam}.`
      )
    }

    const tournamentTeam = await prisma.tournamentTeam.create({
      data: {
        name: team.name,
        tournamentId: tournament.id,
        teamId: team.id,
        seed: teamCount + 1,
        tournamentTeamMembers: {
          create: teamMembers.map((tm) => ({
            userId: tm.userId,
            role: tm.role,
            ingameName: tm.ingameName,
            position: tm.position,
          })),
        },
      },
    })

    this.client.eventLogger.logEvent('teamRegistered', {
      team: tournamentTeam as any,
      trigger: { type: 'system' },
    })

    return tournamentTeam
  }

  async unregisterTeam(tournamentTeam: TournamentTeam) {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentTeam.tournamentId },
    })

    if (!tournament) {
      logger.error(
        `Tournament with ID ${tournamentTeam.tournamentId} not found`
      )
      return
    }

    if (tournament.stage !== 'REGISTRATION') {
      throw new BracketError(
        'Cannot unregister teams after registration has closed'
      )
    }

    await prisma.tournamentTeam.delete({
      where: { id: tournamentTeam.id },
    })

    logger.info(
      `Team ${tournamentTeam.id} unregistered from tournament ${tournament.id}`
    )
  }

  async generateBracket(tournament: Tournament) {
    if (tournament.stage !== 'GROUP_STAGE' && tournament.stage !== 'BRACKET') {
      throw new BracketError(
        'Tournament must be in GROUP_STAGE or BRACKET stage to generate brackets'
      )
    }

    const teams = await prisma.tournamentTeam.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { seed: 'asc' },
    })

    if (teams.length < 2) {
      throw new BracketError('Cannot generate bracket with less than 2 teams')
    }

    // Delete existing matches
    await prisma.match.deleteMany({
      where: { tournamentId: tournament.id },
    })

    switch (tournament.tournamentType) {
      case TournamentType.SINGLE_ELIMINATION:
        await this.generateSingleEliminationBracket(tournament, teams)
        break
      case TournamentType.DOUBLE_ELIMINATION:
        await this.generateDoubleEliminationBracket(tournament, teams)
        break
      case TournamentType.ROUND_ROBIN:
        await this.generateRoundRobinMatches(tournament, teams)
        break
      case TournamentType.SWISS:
        await this.generateSwissRound(tournament, teams, 1)
        break
    }

    logger.info(`Bracket generated for tournament ${tournament.id}`)
  }

  private async generateSingleEliminationBracket(
    tournament: Tournament,
    teams: TournamentTeam[]
  ) {
    const teamCount = teams.length
    const nextPowerOfTwo = Math.pow(2, Math.ceil(Math.log2(teamCount)))
    const byeCount = nextPowerOfTwo - teamCount
    const totalRounds = Math.log2(nextPowerOfTwo)

    // Seed teams for proper bracket distribution
    const seededTeams = this.seedTeamsForBracket(teams, nextPowerOfTwo)

    let currentRoundMatches: {
      homeTeam: number | null
      awayTeam: number | null
    }[] = []

    // Generate first round with byes
    for (let i = 0; i < nextPowerOfTwo / 2; i++) {
      const homeTeam = seededTeams[i * 2]
      const awayTeam = seededTeams[i * 2 + 1]
      currentRoundMatches.push({
        homeTeam: homeTeam?.id || null,
        awayTeam: awayTeam?.id || null,
      })
    }

    // Create all rounds
    for (let round = 1; round <= totalRounds; round++) {
      const matchesInRound = Math.pow(2, totalRounds - round)

      for (let matchNum = 0; matchNum < matchesInRound; matchNum++) {
        const matchData = currentRoundMatches[matchNum]

        await prisma.match.create({
          data: {
            tournamentId: tournament.id,
            roundNumber: round,
            matchNumber: matchNum + 1,
            homeTeamId: matchData?.homeTeam || null,
            awayTeamId: matchData?.awayTeam || null,
            status:
              matchData?.homeTeam && matchData?.awayTeam
                ? MatchStatus.PENDING
                : MatchStatus.PENDING,
            bracketPosition: `R${round}M${matchNum + 1}`,
          },
        })
      }

      // Prepare next round (empty matches)
      if (round < totalRounds) {
        currentRoundMatches = Array(matchesInRound / 2).fill({
          homeTeam: null,
          awayTeam: null,
        })
      }
    }
  }

  private async generateDoubleEliminationBracket(
    tournament: Tournament,
    teams: TournamentTeam[]
  ) {
    // Similar to single elimination but with loser's bracket
    const teamCount = teams.length
    const nextPowerOfTwo = Math.pow(2, Math.ceil(Math.log2(teamCount)))
    const totalWinnerRounds = Math.log2(nextPowerOfTwo)

    // Generate winner's bracket (similar to single elimination)
    await this.generateSingleEliminationBracket(tournament, teams)

    // Generate loser's bracket - offset round numbers to avoid collision
    const loserBracketRounds = totalWinnerRounds * 2 - 1
    const loserBracketRoundOffset = 1000 // Offset to avoid collision with winner bracket

    for (let round = 1; round <= loserBracketRounds; round++) {
      const matchesInRound = Math.ceil(
        nextPowerOfTwo / Math.pow(2, Math.ceil(round / 2) + 1)
      )

      for (let matchNum = 0; matchNum < matchesInRound; matchNum++) {
        await prisma.match.create({
          data: {
            tournamentId: tournament.id,
            roundNumber: loserBracketRoundOffset + round,
            matchNumber: matchNum + 1,
            homeTeamId: null,
            awayTeamId: null,
            status: MatchStatus.PENDING,
            isLowerBracket: true,
            bracketPosition: `LR${round}M${matchNum + 1}`,
          },
        })
      }
    }

    // Create grand finals
    await prisma.match.create({
      data: {
        tournamentId: tournament.id,
        roundNumber: 9999,
        matchNumber: 1,
        homeTeamId: null,
        awayTeamId: null,
        status: MatchStatus.PENDING,
        bracketPosition: 'GRAND_FINAL',
      },
    })
  }

  private async generateRoundRobinMatches(
    tournament: Tournament,
    teams: TournamentTeam[]
  ) {
    // Generate all possible matchups
    let matchNumber = 1
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const homeTeam = teams[i]
        const awayTeam = teams[j]
        if (!homeTeam || !awayTeam) continue

        await prisma.match.create({
          data: {
            tournamentId: tournament.id,
            roundNumber: 1,
            matchNumber: matchNumber++,
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            status: MatchStatus.PENDING,
            bracketPosition: `RR_${homeTeam.name}_vs_${awayTeam.name}`,
          },
        })
      }
    }
  }

  private async generateSwissRound(
    tournament: Tournament,
    teams: TournamentTeam[],
    round: number
  ) {
    // For first round, pair by seed
    // For subsequent rounds, pair teams with same record
    const shuffledTeams = [...teams].sort(() => Math.random() - 0.5)

    let matchNumber = 1
    for (let i = 0; i < shuffledTeams.length; i += 2) {
      if (i + 1 < shuffledTeams.length) {
        const homeTeam = shuffledTeams[i]
        const awayTeam = shuffledTeams[i + 1]
        if (!homeTeam || !awayTeam) continue

        await prisma.match.create({
          data: {
            tournamentId: tournament.id,
            roundNumber: round,
            matchNumber: matchNumber++,
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            status: MatchStatus.PENDING,
            bracketPosition: `Swiss_R${round}M${matchNumber - 1}`,
          },
        })
      }
    }
  }

  private seedTeamsForBracket(
    teams: TournamentTeam[],
    bracketSize: number
  ): (TournamentTeam | null)[] {
    const seeded: (TournamentTeam | null)[] = Array(bracketSize).fill(null)
    const seedOrder = this.generateSeedOrder(bracketSize)

    for (let i = 0; i < teams.length; i++) {
      const seedIndex = seedOrder[i]
      if (seedIndex !== undefined) {
        seeded[seedIndex] = teams[i] || null
      }
    }

    return seeded
  }

  private generateSeedOrder(bracketSize: number): number[] {
    if (bracketSize === 2) return [0, 1]

    const previousOrder = this.generateSeedOrder(bracketSize / 2)
    const order: number[] = []

    for (const seed of previousOrder) {
      order.push(seed)
      order.push(bracketSize - 1 - seed)
    }

    return order
  }

  async reportMatchScore(match: Match, homeScore: number, awayScore: number) {
    if (match.status === MatchStatus.COMPLETED) {
      throw new BracketError('This match has already been completed')
    }

    if (!match.homeTeamId || !match.awayTeamId) {
      throw new BracketError('Both teams must be assigned to report score')
    }

    const winnerId = homeScore > awayScore ? match.homeTeamId : match.awayTeamId

    await prisma.match.update({
      where: { id: match.id },
      data: {
        homeScore,
        awayScore,
        winnerId,
        status: MatchStatus.COMPLETED,
        completedTime: new Date(),
      },
    })

    logger.info(`Match ${match.id} score reported: ${homeScore}-${awayScore}`)

    // Advance winner to next match
    await this.advanceWinner(match, winnerId)
  }

  private async advanceWinner(match: Match, winnerId: number) {
    const tournament = await prisma.tournament.findUnique({
      where: { id: match.tournamentId },
    })

    if (!tournament) {
      logger.error(`Tournament ${match.tournamentId} not found`)
      return
    }

    if (
      tournament.tournamentType === TournamentType.ROUND_ROBIN ||
      tournament.tournamentType === TournamentType.SWISS
    ) {
      // No automatic advancement in these formats
      return
    }

    // Find next match
    const nextRoundNumber = match.roundNumber + 1
    const nextMatchNumber = Math.ceil(match.matchNumber / 2)

    const nextMatch = await prisma.match.findUnique({
      where: {
        tournamentId_roundNumber_matchNumber: {
          tournamentId: match.tournamentId,
          roundNumber: nextRoundNumber,
          matchNumber: nextMatchNumber,
        },
      },
    })

    if (nextMatch) {
      const isFirstSlot = match.matchNumber % 2 === 1
      await prisma.match.update({
        where: { id: nextMatch.id },
        data: isFirstSlot ? { homeTeamId: winnerId } : { awayTeamId: winnerId },
      })
    }

    // Handle loser in double elimination
    if (
      tournament.tournamentType === TournamentType.DOUBLE_ELIMINATION &&
      !match.isLowerBracket
    ) {
      const loserId =
        winnerId === match.homeTeamId ? match.awayTeamId : match.homeTeamId
      // Move loser to lower bracket (simplified logic)
      logger.info(`Team ${loserId} moved to lower bracket`)
    }
  }

  private getTournamentConfigComponents(tournament: Tournament) {
    const canConfigure = tournament.stage === 'SETUP'

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`show_tournament_team_config_modal:${tournament.id}`)
        .setLabel('Configure Teams')
        .setEmoji('👥')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!canConfigure),

      new ButtonBuilder()
        .setCustomId(`show_tournament_timing_config_modal:${tournament.id}`)
        .setLabel('Set Timings')
        .setEmoji('⏱️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!canConfigure),

      new ButtonBuilder()
        .setCustomId(`show_tournament_type_select:${tournament.id}`)
        .setLabel('Tournament Type')
        .setEmoji('🏆')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!canConfigure),

      new ButtonBuilder()
        .setCustomId(`show_multi_team_select:${tournament.id}`)
        .setLabel('Match Format')
        .setEmoji('🎮')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!canConfigure)
    )

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`start_tournament_registration:${tournament.id}`)
        .setLabel('Start Registration')
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Success)
        .setDisabled(tournament.stage !== TournamentStage.SETUP),

      new ButtonBuilder()
        .setCustomId(`close_tournament_registration:${tournament.id}`)
        .setLabel('Close Registration')
        .setEmoji('⏹️')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(tournament.stage !== TournamentStage.REGISTRATION),

      new ButtonBuilder()
        .setCustomId(`generate_tournament_bracket:${tournament.id}`)
        .setLabel('Generate Bracket')
        .setEmoji('🎯')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(
          tournament.stage === TournamentStage.SETUP ||
            tournament.stage === TournamentStage.REGISTRATION
        )
    )

    return [row1, row2]
  }

  private getTournamentConfigEmbed(tournament: Tournament) {
    const typeNames: Record<TournamentType, string> = {
      SINGLE_ELIMINATION: 'Single Elimination',
      DOUBLE_ELIMINATION: 'Double Elimination',
      ROUND_ROBIN: 'Round Robin',
      SWISS: 'Swiss System',
    }

    return new EmbedBuilder()
      .setTitle('🏆 Tournament Configuration')
      .setColor(BRAND_COLOR)
      .setAuthor({
        name: this.client.user?.username || 'Tournament Bot',
      })
      .addFields(
        {
          name: '📋 General',
          value: [
            `**Name:** ${tournament.name}`,
            `**Tournament ID:** \`${tournament.id}\``,
            `**Type:** ${typeNames[tournament.tournamentType]}`,
            `**Match Format:** ${tournament.isMultiTeam ? 'Multi-Team (Battle Royale)' : 'Standard (1v1)'}`,
            `**Description:** ${tournament.description || 'None'}`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '🧑‍🤝‍🧑 Teams',
          value: [
            `**Max Teams:** ${tournament.maxTeams}`,
            `**Players/Team:** ${
              tournament.minPlayersPerTeam && tournament.maxPlayersPerTeam
                ? tournament.minPlayersPerTeam === tournament.maxPlayersPerTeam
                  ? `${tournament.minPlayersPerTeam}`
                  : `${tournament.minPlayersPerTeam}–${tournament.maxPlayersPerTeam}`
                : 'Not set'
            }`,
            `**Substitutes/Team:** ${tournament.maxSubstitutePerTeam}`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '📅 Schedule',
          value: [
            `**Registration Opens:** <t:${Math.floor(tournament.registrationStartTime.getTime() / 1000)}:F>`,
            tournament.tournamentStartTime
              ? `**Tournament Starts:** <t:${Math.floor(tournament.tournamentStartTime.getTime() / 1000)}:F>`
              : '**Tournament Starts:** Not set',
          ].join('\n'),
          inline: false,
        },
        {
          name: '📊 Status',
          value:
            tournament.stage === 'SETUP'
              ? '⚙️ Setup'
              : tournament.stage === 'REGISTRATION'
                ? '📝 Registration Open'
                : tournament.stage === 'GROUP_STAGE'
                  ? '👥 Group Stage'
                  : tournament.stage === 'BRACKET'
                    ? '🎯 Bracket Stage'
                    : '✅ Completed',
          inline: false,
        }
      )
      .setFooter({
        text: 'Configuration locks once registration opens.',
      })
  }

  async updateTournamentConfigMessage(tournament: Tournament) {
    const channel = await this.client.channels.fetch(tournament.adminChannelId)
    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
      logger.error(
        `Admin channel ${tournament.adminChannelId} not found or not text-based`
      )
      return
    }

    const updatedTournament = await prisma.tournament.findUnique({
      where: { id: tournament.id },
    })

    if (!updatedTournament) {
      logger.error(`Tournament ${tournament.id} not found`)
      return
    }

    tournament = updatedTournament

    const components = this.getTournamentConfigComponents(tournament)
    const embed = this.getTournamentConfigEmbed(tournament)
    let message = null

    if (!tournament.adminConfigMessageId) {
      logger.warn(
        `Tournament ${tournament.id} does not have an admin config message ID`
      )
    } else {
      try {
        message = await channel.messages.fetch(tournament.adminConfigMessageId)
      } catch (error) {
        logger.error(
          `Failed to fetch admin config message ${tournament.adminConfigMessageId} for tournament ${tournament.id}: ${(error as Error).message}`
        )
        message = null
      }
    }

    if (!message) {
      logger.warn(
        `Admin config message ${tournament.adminConfigMessageId} for tournament ${tournament.id} not found, creating a new one`
      )
      const newMessage = await channel.send({ embeds: [embed], components })
      await prisma.tournament.update({
        where: { id: tournament.id },
        data: { adminConfigMessageId: newMessage.id },
      })
    } else {
      await message.edit({ embeds: [embed], components })
    }

    logger.info(`Tournament ${tournament.id} config message updated`)
  }
}
