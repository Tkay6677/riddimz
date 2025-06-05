"use strict";
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
// Create dist directory if it doesn't exist
if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
}
// Clean dist directory
if (fs.existsSync('dist/server')) {
    fs.rmSync('dist/server', { recursive: true, force: true });
}
// Compile TypeScript
execSync('tsc -p tsconfig.server.json', { stdio: 'inherit' });
// Copy package.json to dist
const packageJson = require('./package.json');
const serverPackageJson = {
    name: packageJson.name,
    version: packageJson.version,
    main: 'server/socket.js',
    dependencies: {
        'socket.io': packageJson.dependencies['socket.io'],
        'next': packageJson.dependencies['next'],
        'dotenv': packageJson.dependencies['dotenv']
    }
};
fs.writeFileSync(path.join('dist', 'package.json'), JSON.stringify(serverPackageJson, null, 2));
// Copy .env file if it exists
if (fs.existsSync('.env')) {
    fs.copyFileSync('.env', path.join('dist', '.env'));
}
// Copy Next.js app directory
if (fs.existsSync('app')) {
    fs.cpSync('app', path.join('dist', 'app'), { recursive: true });
}
// Copy Next.js public directory
if (fs.existsSync('public')) {
    fs.cpSync('public', path.join('dist', 'public'), { recursive: true });
}
// Copy Next.js configuration
if (fs.existsSync('next.config.js')) {
    fs.copyFileSync('next.config.js', path.join('dist', 'next.config.js'));
}
// Copy TypeScript configuration
if (fs.existsSync('tsconfig.json')) {
    fs.copyFileSync('tsconfig.json', path.join('dist', 'tsconfig.json'));
}
// Copy other necessary files
const filesToCopy = [
    'middleware.ts',
    'next-env.d.ts',
    'postcss.config.js',
    'tailwind.config.ts'
];
filesToCopy.forEach(file => {
    if (fs.existsSync(file)) {
        fs.copyFileSync(file, path.join('dist', file));
    }
});
console.log('Server build completed!');
