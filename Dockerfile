FROM node:16.18.1 as builder

WORKDIR /home

COPY /app/package*.json .

RUN npm ci

COPY /app .

RUN npm run build


FROM node:16.18.1 as runner

WORKDIR /home

COPY /app/package*.json .

RUN npm install --omit=dev

COPY --from=builder /home/build .

CMD [ "npm", "start" ]