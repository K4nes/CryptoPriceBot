const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, '..', 'users.json');

async function getUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = await fs.promises.readFile(USERS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading users file:', err.message);
  }
  return [];
}

async function saveUsers(users) {
  const tempFile = USERS_FILE + '.tmp';
  await fs.promises.writeFile(tempFile, JSON.stringify(users, null, 2));
  await fs.promises.rename(tempFile, USERS_FILE);
}

async function isNewUser(chatId) {
  const users = await getUsers();
  return !users.includes(chatId);
}

async function markUserSeen(chatId) {
  const users = await getUsers();
  if (!users.includes(chatId)) {
    users.push(chatId);
    await saveUsers(users);
  }
}

module.exports = { isNewUser, markUserSeen };
