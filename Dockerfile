FROM node:18.19.1 as builder

WORKDIR /home

COPY /*.json .
RUN npm ci

COPY /src ./src
RUN npm run build


FROM node:18.19.1 as runner

WORKDIR /home

COPY /package*.json .
RUN npm install --omit=dev

COPY --from=builder /home/build .
CMD [ "npm", "start" ]