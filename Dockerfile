FROM node:18 as builder

WORKDIR /home

COPY /*.json .
RUN npm ci --omit=dev

COPY /src ./src
RUN npm run build


FROM node:18 as runner

WORKDIR /home

COPY /package*.json .
RUN npm ci --omit=dev

COPY --from=builder /home/build .
CMD [ "npm", "start" ]