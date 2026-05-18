// src/utils/cache.js
const { Redis } = require('@upstash/redis');

let redisClient = null;

// Inicialización perezosa (Lazy initialization) del cliente Redis
const getRedisClient = () => {
    if (redisClient !== null) return redisClient;

    if (!process.env.UPSTASH_REDIS_KV_REST_API_URL || !process.env.UPSTASH_REDIS_KV_REST_API_TOKEN) {
        console.warn('⚠️ Upstash Redis credentials not found in environment variables. Caching is disabled.');
        redisClient = false; // Marcamos como false para no intentar reconectar en cada llamada
        return false;
    }

    try {
        redisClient = new Redis({
            url: process.env.UPSTASH_REDIS_KV_REST_API_URL,
            token: process.env.UPSTASH_REDIS_KV_REST_API_TOKEN,
        });
        return redisClient;
    } catch (err) {
        console.error('❌ Failed to initialize Upstash Redis client:', err);
        redisClient = false;
        return false;
    }
};

/**
 * Obtiene un valor de la caché de Redis.
 * Fail-safe: si hay algún error, devuelve null para que la aplicación haga fallback a la BD.
 * @param {string} key 
 * @returns {Promise<any>}
 */
const getCache = async (key) => {
    const client = getRedisClient();
    if (!client) return null;

    try {
        const data = await client.get(key);
        // Upstash Redis SDK automatically parses JSON by default if it detects an object.
        return data;
    } catch (err) {
        console.error(`❌ Redis Get Error [${key}]:`, err.message);
        return null;
    }
};

/**
 * Guarda un valor en la caché de Redis.
 * Fail-safe: ignora errores si falla para no romper la respuesta del usuario.
 * @param {string} key 
 * @param {any} data 
 * @param {number} ttlSeconds 
 */
const setCache = async (key, data, ttlSeconds = 300) => {
    const client = getRedisClient();
    if (!client) return;

    try {
        await client.set(key, data, { ex: ttlSeconds });
    } catch (err) {
        console.error(`❌ Redis Set Error [${key}]:`, err.message);
    }
};

/**
 * Elimina una clave de la caché (invalidation).
 * @param {string} key 
 */
const delCache = async (key) => {
    const client = getRedisClient();
    if (!client) return;

    try {
        await client.del(key);
    } catch (err) {
        console.error(`❌ Redis Del Error [${key}]:`, err.message);
    }
};

module.exports = {
    getCache,
    setCache,
    delCache
};
