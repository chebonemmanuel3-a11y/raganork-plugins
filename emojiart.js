const axios = require('axios');
const { Module } = require('../main');

Module({
  pattern: 'art ?(.*)',
  fromMe: false,
  desc: 'Fetch ASCII art for emoji/text',
  type: 'fun'
}, async (message, match) => {
  const query = (match[1] || '').trim();
  if (!query) return message.sendReply('Usage: .art <emoji or text>');

  try {
    const res = await axios.get(`https://asciified.thelicato.com/api?text=${encodeURIComponent(query)}`);
    return message.sendReply(res.data.ascii || 'No art found.');
  } catch (e) {
    return message.sendReply('Error fetching art. Try again later.');
  }
});
