import crypto from 'crypto';

// Custom Lightweight Encryption Configuration
const BLOCK_SIZE = 16; // 128 bits (16 bytes)
const KEY_SIZE = 16;   // 128-bit key
const ROUNDS = 3;      // Number of encryption rounds
const SERVER_SALT = 'KrishnaCrypt2024SecureTunnel'; // Server-side salt

// Custom S-Box for byte substitution (256 values, 0-255)
const SBOX = [
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
];

// Inverse S-Box for decryption
const INV_SBOX = new Array(256);
for (let i = 0; i < 256; i++) {
    INV_SBOX[SBOX[i]] = i;
}

// Mix matrix for column mixing (4x4 matrix)
const MIX_MATRIX = [
    [0x02, 0x03, 0x01, 0x01],
    [0x01, 0x02, 0x03, 0x01],
    [0x01, 0x01, 0x02, 0x03],
    [0x03, 0x01, 0x01, 0x02]
];

// Inverse mix matrix for decryption
const INV_MIX_MATRIX = [
    [0x0e, 0x0b, 0x0d, 0x09],
    [0x09, 0x0e, 0x0b, 0x0d],
    [0x0d, 0x09, 0x0e, 0x0b],
    [0x0b, 0x0d, 0x09, 0x0e]
];

/**
 * Galois Field multiplication for matrix operations
 * @param {number} a - First operand
 * @param {number} b - Second operand
 * @returns {number} Result of GF multiplication
 */
function galoisMultiply(a, b) {
    let result = 0;
    let temp = a;
    
    for (let i = 0; i < 8; i++) {
        if (b & 1) {
            result ^= temp;
        }
        
        const highBit = temp & 0x80;
        temp <<= 1;
        
        if (highBit) {
            temp ^= 0x1b; // AES irreducible polynomial
        }
        
        b >>= 1;
    }
    
    return result & 0xff;
}

/**
 * Generate encryption key from user IDs and server salt
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @returns {Buffer} 128-bit encryption key
 */
function generateKey(userId1, userId2) {
    // Sort user IDs for consistent key generation
    const sortedIds = [userId1, userId2].sort();
    const keyMaterial = sortedIds.join('') + SERVER_SALT;
    
    // Generate SHA-256 hash and take first 16 bytes (128 bits)
    const hash = crypto.createHash('sha256').update(keyMaterial).digest();
    return hash.slice(0, KEY_SIZE);
}

/**
 * Apply PKCS#7 padding to data
 * @param {Buffer} data - Data to pad
 * @returns {Buffer} Padded data
 */
function addPadding(data) {
    const paddingLength = BLOCK_SIZE - (data.length % BLOCK_SIZE);
    const padding = Buffer.alloc(paddingLength, paddingLength);
    return Buffer.concat([data, padding]);
}

/**
 * Remove PKCS#7 padding from data
 * @param {Buffer} data - Padded data
 * @returns {Buffer} Unpadded data
 */
function removePadding(data) {
    const paddingLength = data[data.length - 1];
    return data.slice(0, data.length - paddingLength);
}

/**
 * Substitute bytes using S-Box
 * @param {Buffer} block - 16-byte block
 * @param {Array} sbox - S-Box to use
 * @returns {Buffer} Substituted block
 */
function substituteBytes(block, sbox) {
    const result = Buffer.alloc(BLOCK_SIZE);
    for (let i = 0; i < BLOCK_SIZE; i++) {
        result[i] = sbox[block[i]];
    }
    return result;
}

/**
 * Shift rows in the block (AES-like operation)
 * @param {Buffer} block - 16-byte block
 * @param {boolean} inverse - Whether to perform inverse operation
 * @returns {Buffer} Block with shifted rows
 */
function shiftRows(block, inverse = false) {
    const result = Buffer.alloc(BLOCK_SIZE);
    
    // Treat block as 4x4 matrix and shift rows
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
            const shift = inverse ? (4 - row) % 4 : row;
            const srcCol = (col + shift) % 4;
            result[row * 4 + col] = block[row * 4 + srcCol];
        }
    }
    
    return result;
}

/**
 * Mix columns using matrix multiplication in Galois Field
 * @param {Buffer} block - 16-byte block
 * @param {Array} matrix - Mix matrix to use
 * @returns {Buffer} Block with mixed columns
 */
function mixColumns(block, matrix) {
    const result = Buffer.alloc(BLOCK_SIZE);
    
    // Process each column (4 columns, 4 bytes each)
    for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 4; row++) {
            let value = 0;
            for (let i = 0; i < 4; i++) {
                value ^= galoisMultiply(matrix[row][i], block[i * 4 + col]);
            }
            result[row * 4 + col] = value;
        }
    }
    
    return result;
}

/**
 * XOR block with key
 * @param {Buffer} block - Data block
 * @param {Buffer} key - Key block
 * @returns {Buffer} XORed result
 */
function xorBlock(block, key) {
    const result = Buffer.alloc(block.length);
    for (let i = 0; i < block.length; i++) {
        result[i] = block[i] ^ key[i % key.length];
    }
    return result;
}

/**
 * Encrypt a single block using custom algorithm
 * @param {Buffer} block - 16-byte plaintext block
 * @param {Buffer} key - 16-byte encryption key
 * @returns {Buffer} Encrypted block
 */
function encryptBlock(block, key) {
    let state = Buffer.from(block);
    
    // Initial key addition
    state = xorBlock(state, key);
    
    // Perform encryption rounds
    for (let round = 0; round < ROUNDS; round++) {
        // Byte substitution
        state = substituteBytes(state, SBOX);
        
        // Row shifting
        state = shiftRows(state);
        
        // Column mixing (skip in last round)
        if (round < ROUNDS - 1) {
            state = mixColumns(state, MIX_MATRIX);
        }
        
        // Key addition (use round-specific key derivation)
        const roundKey = crypto.createHash('sha256')
            .update(key)
            .update(Buffer.from([round]))
            .digest()
            .slice(0, KEY_SIZE);
        state = xorBlock(state, roundKey);
    }
    
    return state;
}

/**
 * Decrypt a single block using custom algorithm
 * @param {Buffer} block - 16-byte ciphertext block
 * @param {Buffer} key - 16-byte decryption key
 * @returns {Buffer} Decrypted block
 */
function decryptBlock(block, key) {
    let state = Buffer.from(block);
    
    // Reverse the encryption process
    for (let round = ROUNDS - 1; round >= 0; round--) {
        // Reverse key addition
        const roundKey = crypto.createHash('sha256')
            .update(key)
            .update(Buffer.from([round]))
            .digest()
            .slice(0, KEY_SIZE);
        state = xorBlock(state, roundKey);
        
        // Reverse column mixing (skip in first reverse round)
        if (round < ROUNDS - 1) {
            state = mixColumns(state, INV_MIX_MATRIX);
        }
        
        // Reverse row shifting
        state = shiftRows(state, true);
        
        // Reverse byte substitution
        state = substituteBytes(state, INV_SBOX);
    }
    
    // Reverse initial key addition
    state = xorBlock(state, key);
    
    return state;
}

/**
 * Encrypt message using custom CBC mode
 * @param {string} message - Plaintext message
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @returns {string} Base64 encoded encrypted message with IV
 */
export function encryptMessage(message, userId1, userId2) {
    try {
        // Generate key from user IDs
        const key = generateKey(userId1, userId2);
        
        // Convert message to buffer and add padding
        const plaintext = Buffer.from(message, 'utf8');
        const paddedData = addPadding(plaintext);
        
        // Generate random IV
        const iv = crypto.randomBytes(BLOCK_SIZE);
        
        // Encrypt using CBC mode
        const encrypted = [];
        let previousBlock = iv;
        
        for (let i = 0; i < paddedData.length; i += BLOCK_SIZE) {
            const block = paddedData.slice(i, i + BLOCK_SIZE);
            const xorBlock = Buffer.alloc(BLOCK_SIZE);
            
            // XOR with previous ciphertext block (CBC mode)
            for (let j = 0; j < BLOCK_SIZE; j++) {
                xorBlock[j] = block[j] ^ previousBlock[j];
            }
            
            // Encrypt the XORed block
            const encryptedBlock = encryptBlock(xorBlock, key);
            encrypted.push(encryptedBlock);
            previousBlock = encryptedBlock;
        }
        
        // Combine IV and encrypted data
        const result = Buffer.concat([iv, ...encrypted]);
        
        // Return base64 encoded result
        return result.toString('base64');
        
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt message');
    }
}

/**
 * Decrypt message using custom CBC mode
 * @param {string} encryptedData - Base64 encoded encrypted message with IV
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @returns {string} Decrypted plaintext message
 */
export function decryptMessage(encryptedData, userId1, userId2) {
    try {
        // Generate key from user IDs
        const key = generateKey(userId1, userId2);
        
        // Decode base64 data
        const data = Buffer.from(encryptedData, 'base64');
        
        // Extract IV and ciphertext
        const iv = data.slice(0, BLOCK_SIZE);
        const ciphertext = data.slice(BLOCK_SIZE);
        
        // Decrypt using CBC mode
        const decrypted = [];
        let previousBlock = iv;
        
        for (let i = 0; i < ciphertext.length; i += BLOCK_SIZE) {
            const encryptedBlock = ciphertext.slice(i, i + BLOCK_SIZE);
            
            // Decrypt the block
            const decryptedBlock = decryptBlock(encryptedBlock, key);
            
            // XOR with previous ciphertext block (CBC mode)
            const plainBlock = Buffer.alloc(BLOCK_SIZE);
            for (let j = 0; j < BLOCK_SIZE; j++) {
                plainBlock[j] = decryptedBlock[j] ^ previousBlock[j];
            }
            
            decrypted.push(plainBlock);
            previousBlock = encryptedBlock;
        }
        
        // Combine decrypted blocks and remove padding
        const paddedPlaintext = Buffer.concat(decrypted);
        const plaintext = removePadding(paddedPlaintext);
        
        // Return UTF-8 string
        return plaintext.toString('utf8');
        
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt message');
    }
}

/**
 * Generate secure room ID from user IDs
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @returns {string} SHA-256 hash of sorted user IDs
 */
export function generateRoomId(userId1, userId2) {
    const sortedIds = [userId1, userId2].sort();
    return crypto.createHash('sha256').update(sortedIds.join('')).digest('hex');
}

/**
 * Simulate VPN-like tunnel encryption (server-side)
 * @param {string} message - Message to encrypt
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @returns {Object} Tunnel encryption result with metadata
 */
export function tunnelEncrypt(message, userId1, userId2) {
    const startTime = Date.now();
    const encrypted = encryptMessage(message, userId1, userId2);
    const endTime = Date.now();
    
    return {
        success: true,
        encrypted,
        metadata: {
            algorithm: 'KrishnaCrypt-Custom-CBC',
            keySize: KEY_SIZE * 8, // bits
            blockSize: BLOCK_SIZE * 8, // bits
            rounds: ROUNDS,
            encryptionTime: endTime - startTime,
            tunnelId: generateRoomId(userId1, userId2),
            timestamp: new Date().toISOString()
        }
    };
}

/**
 * Simulate VPN-like tunnel decryption (server-side)
 * @param {string} encryptedData - Encrypted message
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @returns {Object} Tunnel decryption result with metadata
 */
export function tunnelDecrypt(encryptedData, userId1, userId2) {
    const startTime = Date.now();
    const decrypted = decryptMessage(encryptedData, userId1, userId2);
    const endTime = Date.now();
    
    return {
        success: true,
        decrypted,
        metadata: {
            algorithm: 'KrishnaCrypt-Custom-CBC',
            keySize: KEY_SIZE * 8, // bits
            blockSize: BLOCK_SIZE * 8, // bits
            rounds: ROUNDS,
            decryptionTime: endTime - startTime,
            tunnelId: generateRoomId(userId1, userId2),
            timestamp: new Date().toISOString()
        }
    };
}

/**
 * Validate encrypted message format
 * @param {string} encryptedData - Base64 encoded encrypted data
 * @returns {boolean} True if format is valid
 */
export function validateEncryptedFormat(encryptedData) {
    try {
        const data = Buffer.from(encryptedData, 'base64');
        // Must have at least IV + one block
        return data.length >= BLOCK_SIZE * 2 && data.length % BLOCK_SIZE === 0;
    } catch {
        return false;
    }
}

/**
 * Test the encryption/decryption functionality
 * @returns {Object} Test results
 */
export function testEncryption() {
    const testMessage = "Hello, this is a test message for KrishnaCrypt!";
    const userId1 = "user123";
    const userId2 = "user456";
    
    try {
        console.log('Testing KrishnaCrypt Custom Encryption...');
        console.log('Original message:', testMessage);
        
        // Test encryption
        const encrypted = encryptMessage(testMessage, userId1, userId2);
        console.log('Encrypted (base64):', encrypted);
        
        // Test decryption
        const decrypted = decryptMessage(encrypted, userId1, userId2);
        console.log('Decrypted message:', decrypted);
        
        // Test tunnel functions
        const tunnelEnc = tunnelEncrypt(testMessage, userId1, userId2);
        const tunnelDec = tunnelDecrypt(tunnelEnc.encrypted, userId1, userId2);
        
        // Test room ID generation
        const roomId = generateRoomId(userId1, userId2);
        console.log('Room ID:', roomId);
        
        const success = testMessage === decrypted && testMessage === tunnelDec.decrypted;
        
        return {
            success,
            original: testMessage,
            encrypted,
            decrypted,
            roomId,
            tunnelMetadata: tunnelEnc.metadata,
            message: success ? 'All tests passed!' : 'Tests failed!'
        };
        
    } catch (error) {
        console.error('Test failed:', error);
        return {
            success: false,
            error: error.message,
            message: 'Encryption test failed!'
        };
    }
}
