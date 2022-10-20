FROM node:16 as builder

WORKDIR /home

COPY /app/package*.json .

RUN npm ci

COPY /app .

RUN npm run build


FROM node:16 as runner

WORKDIR /home

COPY /app/package*.json .

RUN npm install --omit=dev

COPY --from=appbuilder /home/build .

CMD [ "npm", "start" ]