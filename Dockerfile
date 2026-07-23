FROM node:24-alpine
WORKDIR /gdl-api
COPY . .
COPY .env.example .env
RUN npm i
CMD [ "npm", "start" ]
