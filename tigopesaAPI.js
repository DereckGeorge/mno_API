const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const axios = require('axios'); 

const app = express();
app.use(bodyParser.json());


const dbTigopesa = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'tigopesa_db'
});

dbTigopesa.connect((err) => {
    if (err) {
        console.error('Error connecting to Tigo Pesa database:', err);
        return;
    }
    console.log('Connected to the Tigo Pesa database.');
});


app.post('/sendMoney', async (req, res) => {
    const { fromUser, toUser, toNetwork, amount } = req.body;


    dbTigopesa.query('SELECT balance FROM users WHERE name = ?', [fromUser], (err, results) => {
        if (err || results.length === 0) {
            return res.status(400).json({ message: 'Sender not found or database error' });
        }

        const senderBalance = results[0].balance;
        if (senderBalance < amount) {
            return res.status(400).json({ message: 'Insufficient balance' });
        }

   
        dbTigopesa.query('UPDATE users SET balance = balance - ? WHERE name = ?', [amount, fromUser], async (err) => {
            if (err) {
                return res.status(500).json({ message: 'Error deducting from sender' });
            }

            if (toNetwork === 'mpesa') {
                try {
                    const response = await axios.post('http://localhost:5000/receiveMoney', {
                        toUser,
                        amount
                    });

                    res.status(200).json({ message: `Successfully sent ${amount} to ${toUser} on M-Pesa`, receiverResponse: response.data });
                } catch (err) {
             
                    dbTigopesa.query('UPDATE users SET balance = balance + ? WHERE name = ?', [amount, fromUser], () => {
                        res.status(500).json({ message: 'Error updating M-Pesa balance, transaction rolled back' });
                    });
                }
            } else {
                res.status(400).json({ message: 'Invalid target network' });
            }
        });
    });
});

app.post('/receiveMoney', (req, res) => {
    const { toUser, amount } = req.body;

   
    dbTigopesa.query('UPDATE users SET balance = balance + ? WHERE name = ?', [amount, toUser], (err) => {
        if (err) {
            return res.status(500).json({ message: 'Error updating receiver balance in Tigo Pesa' });
        }
        res.status(200).json({ message: `Received ${amount} successfully` });
    });
});

app.listen(6000, () => {
    console.log('Tigo Pesa API running on port 6000');
});
