FROM mcr.microsoft.com/playwright:v1.48.2-jammy

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV IG_HEADLESS=true
CMD ["npm", "run", "ig:collect"]
