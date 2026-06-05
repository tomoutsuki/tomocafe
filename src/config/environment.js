const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..', '..');

function readCliOption(name) {
    const prefix = `--${name}=`;
    const option = process.argv.find((argument) => argument.startsWith(prefix));
    return option ? option.slice(prefix.length) : undefined;
}

function normalizeAppEnv(value) {
    if (!value) {
        return 'development';
    }

    const normalized = value.toLowerCase();
    if (normalized === 'prod') {
        return 'production';
    }
    if (normalized === 'dev') {
        return 'development';
    }
    return normalized;
}

function buildEnvCandidates(appEnv) {
    if (appEnv === 'production') {
        return ['.env.production.local', '.env.production', '.env'];
    }

    if (appEnv === 'development') {
        return ['.env.development.local', '.env.development', '.env.dev.local', '.env.dev', '.env.local', '.env'];
    }

    return [`.env.${appEnv}.local`, `.env.${appEnv}`, '.env'];
}

function resolveEnvFile(filePath) {
    if (!filePath) {
        return null;
    }

    if (path.isAbsolute(filePath)) {
        return filePath;
    }

    return path.join(rootDir, filePath);
}

const inferredDefaultEnv = process.env.DYNO ? 'production' : 'development';
const appEnv = normalizeAppEnv(
    readCliOption('app-env')
    || process.env.APP_ENV
    || process.env.NODE_ENV
    || inferredDefaultEnv
);
const explicitEnvFile = readCliOption('env-file') || process.env.ENV_FILE;

let loadedEnvFile = null;

if (explicitEnvFile) {
    const resolvedEnvFile = resolveEnvFile(explicitEnvFile);

    if (!fs.existsSync(resolvedEnvFile)) {
        throw new Error(`Environment file not found: ${resolvedEnvFile}`);
    }

    dotenv.config({ path: resolvedEnvFile });
    loadedEnvFile = path.relative(rootDir, resolvedEnvFile);
} else if (!process.env.DYNO) {
    for (const candidate of buildEnvCandidates(appEnv)) {
        const resolvedCandidate = path.join(rootDir, candidate);
        if (!fs.existsSync(resolvedCandidate)) {
            continue;
        }

        dotenv.config({ path: resolvedCandidate });
        loadedEnvFile = candidate;
        break;
    }
}

process.env.APP_ENV = appEnv;
if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = appEnv === 'production' ? 'production' : 'development';
}

function assertRequiredEnv(requiredKeys) {
    const missingKeys = requiredKeys.filter((key) => {
        const value = process.env[key];
        return typeof value !== 'string' || value.trim() === '';
    });

    if (missingKeys.length > 0) {
        throw new Error(
            `Missing required environment variables for ${appEnv}: ${missingKeys.join(', ')}`
        );
    }
}

module.exports = {
    appEnv,
    assertRequiredEnv,
    isDevelopment: appEnv === 'development',
    isProduction: appEnv === 'production',
    loadedEnvFile,
    rootDir
};
