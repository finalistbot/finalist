FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY prisma ./prisma
RUN pnpm exec prisma generate
COPY . .
RUN pnpm build
CMD ["pnpm", "start"]
