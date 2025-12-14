const bcrypt = require('bcrypt');

const password = 'asdf';
const hash = '$2b$12$8SHJ7Lah8cyXHR2TsK25YORiR3zioTQKgEjJBn07tHCPEObCBnTxm';

bcrypt.compare(password, hash, (err, result) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Password matches:', result);
  }
});
