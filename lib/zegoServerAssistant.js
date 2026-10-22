const crypto = require('crypto');

// Mirror of ZEGOCLOUD's official Token04 generator (zego_server_assistant/nodejs)
// https://github.com/ZEGOCLOUD/zego_server_assistant/blob/master/token/nodejs/server/zegoServerAssistant.js

// RndNum returns a random number within the given range (inclusive)
function RndNum(a, b) {
    return Math.ceil((a + (b - a)) * Math.random());
}

// zgenerate a random 16 character string used as the AES-CBC IV
function makeRandomIv() {
    const str = '0123456789abcdefghijklmnopqrstuvwxyz';
    let result = [];
    for (let i = 0; i < 16; i++) {
        result.push(str.charAt(Math.floor(Math.random() * str.length)));
    }
    return result.join('');
}

// select the AES variant based on the key byte length (16/24/32)
function getAlgorithm(key) {
    switch (key.length) {
        case 16: return 'aes-128-cbc';
        case 24: return 'aes-192-cbc';
        case 32: return 'aes-256-cbc';
    }
    throw new Error('Invalid key length: ' + key.length);
}

// AES encryption using CBC mode with PKCS5 padding
function aesEncrypt(plainText, key, iv) {
    const cipher = crypto.createCipheriv(getAlgorithm(key), key, Buffer.from(iv, 'utf8'));
    cipher.setAutoPadding(true);
    return Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
}

function generateToken04(appId, userId, secret, effectiveTimeInSeconds, payload) {
    if (!appId || typeof appId !== 'number') {
        throw new Error('appID invalid');
    }
    if (!userId || typeof userId !== 'string') {
        throw new Error('userId invalid');
    }
    if (!secret || typeof secret !== 'string' || secret.length !== 32) {
        throw new Error('secret must be a 32 byte string');
    }
    if (!effectiveTimeInSeconds || typeof effectiveTimeInSeconds !== 'number') {
        throw new Error('effectiveTimeInSeconds invalid');
    }

    const createTime = Math.floor(new Date().getTime() / 1000);
    const tokenInfo = {
        app_id: appId,
        user_id: userId,
        nonce: RndNum(-2147483648, 2147483647), // MUST be int64
        ctime: createTime,
        expire: createTime + effectiveTimeInSeconds,
        payload: payload || ''
    };

    const plainText = JSON.stringify(tokenInfo);
    const key = Buffer.from(secret, 'utf8');
    const iv = makeRandomIv();
    const encryptBuf = aesEncrypt(plainText, key, iv);

    const b1 = Buffer.alloc(8);
    b1.writeBigInt64BE(BigInt(tokenInfo.expire), 0);
    const b2 = Buffer.alloc(2);
    b2.writeUInt16BE(iv.length, 0);
    const b3 = Buffer.alloc(2);
    b3.writeUInt16BE(encryptBuf.length, 0);

    const buf = Buffer.concat([b1, b2, Buffer.from(iv, 'utf8'), b3, encryptBuf]);
    return '04' + buf.toString('base64');
}

module.exports = {
    generateToken04
};