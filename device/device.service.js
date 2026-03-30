const pendingCodes = new Map();     // code → { userId, createdAt }

function generateCode() {
    const parts = [
        Math.floor(100 + Math.random() * 900),
        Math.floor(100 + Math.random() * 900),
        Math.floor(100 + Math.random() * 900)
    ];
    return parts.join('-');
}

function createPendingCode(userId, deviceName, group, description) {
    const code = generateCode();
    
    pendingCodes.set(code, {
        userId,
        createdAt: Date.now(),
        deviceName: deviceName || 'Unnamed Device',     // fallback
        group: group || 'Default Group',
        description: description || ''
    });

    // Auto-expire after 15 minutes
    setTimeout(() => {
        pendingCodes.delete(code);
    }, 15 * 60 * 1000);

    return code;
}

function getPendingCodeInfo(code) {
    return pendingCodes.get(code) || null;
}

function consumePendingCode(code) {
    const info = pendingCodes.get(code);
    if (info) {
        pendingCodes.delete(code);
        return info;
    }
    return null;
}



module.exports = {
    createPendingCode,
    getPendingCodeInfo,
    consumePendingCode
};