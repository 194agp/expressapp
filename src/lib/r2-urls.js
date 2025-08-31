// src/lib/r2-urls.js
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl }     = require('@aws-sdk/s3-request-presigner');
const { s3 }               = require('../config/s3');

function publicUrl({ bucket, accountId, key }) {
  return `https://${bucket}.${accountId}.r2.dev/${key}`;
}

async function presignedGetUrl({ bucket, key, expiresIn = 60 }) {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn });
}

async function getUrlFor(fileDoc, { presignTtl = 60 } = {}) {
  if (!fileDoc) return null;
  const { bucket, key, isPublic } = fileDoc;
  if (isPublic) {
    return publicUrl({ bucket, accountId: process.env.CLDFR_ACCOUNT_ID, key });
  }
  return presignedGetUrl({ bucket, key, expiresIn: presignTtl });
}

module.exports = { publicUrl, presignedGetUrl, getUrlFor };
