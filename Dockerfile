FROM node:16 as appbuilder

WORKDIR /home

COPY /app/package*.json .

RUN npm ci

COPY /app .

RUN npm run build


FROM cirrusci/flutter:stable as webbuilder

WORKDIR /home

RUN flutter doctor

RUN flutter config --enable-web

COPY /web .

RUN flutter clean

RUN flutter build web


FROM node:16 as runner

WORKDIR /home

COPY /app/package*.json .

RUN npm install --omit=dev

COPY --from=appbuilder /home/build .

COPY --from=webbuilder /home/build .

CMD [ "npm", "start" ]