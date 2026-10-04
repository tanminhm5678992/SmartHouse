FROM node:20-alpine

# ==========================================================
# BẮT BUỘC: cài OpenSSL trước khi cài Prisma
# ----------------------------------------------------------
# Alpine 3.17+ chỉ có libssl.so.3 và KHÔNG có sẵn gói "openssl".
# Vì thiếu gói này, Prisma không dò được phiên bản OpenSSL nên mặc
# định chọn engine biên dịch cho OpenSSL 1.1 -> khi chạy báo lỗi:
#   Error loading shared library libssl.so.1.1: No such file or directory
# Cài openssl giúp Prisma nhận đúng binaryTarget "linux-musl-openssl-3.0.x".
# ==========================================================
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

RUN npx prisma generate

COPY . .

EXPOSE 4000

CMD ["sh", "-c", "npx prisma db push && npm start"]
