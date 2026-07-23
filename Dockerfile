FROM node:24-alpine
WORKDIR /gdl-api
COPY . .
COPY .env.example .env
RUN npm ci
CMD [ "npm", "start" ]
