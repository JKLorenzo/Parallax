FROM node:16 as builder

# Create app directory
WORKDIR /usr/src/app

# Install global dependencies
RUN npm install -g typescript ts-node

# Install app dependencies
COPY package*.json ./
RUN npm ci

# Bundle app source
COPY . .

# Build app
RUN npm run build


FROM node:16 as runner

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm ci

# Bundle app source
COPY --from=builder /usr/src/app/build ./build

# Start app
CMD [ "npm", "start" ]