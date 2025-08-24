// config/s3.js
require('dotenv').config();
const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  endpoint:        process.env.ENDPOINT_URL,
  accessKeyId:     process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
  signatureVersion:'v4',
  region:          'auto',
});

module.exports = s3;
