const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const axios = require('axios'); 

const app = express();
app.use(bodyParser.json());

const dbMpesa = mysql.createConnection({
    host: '',
    user: '',
    password: '',
    database: ''
});

dbMpesa.connect((err) => {
    if (err) {
        console.error('Error connecting to M-Pesa database:', err);
        return;
    }
    console.log('Connected to the M-Pesa database.');
});


app.post('/sendMoney', async (req, res) => {
    console.log('Request Body:', req.body);
    const { fromUser, toUser, toNetwork, amount } = req.body;

  
    dbMpesa.query('SELECT balance FROM users WHERE name = ?', [fromUser], (err, results) => {
        if (err) {
            console.error('Database query error:', err); 
            return res.status(500).json({ message: 'Database error occurred' });
        }
        if (results.length === 0) {
            return res.status(400).json({ message: 'Sender not found' });
        }

        const senderBalance = results[0].balance;
        if (senderBalance < amount) {
            return res.status(400).json({ message: 'Insufficient balance' });
        }

        
        dbMpesa.query('UPDATE users SET balance = balance - ? WHERE name = ?', [amount, fromUser], async (err) => {
            if (err) {
                return res.status(500).json({ message: 'Error deducting from sender' });
            }

          
            if (toNetwork === 'tigopesa') {
                try {
                    const response = await axios.post('http://localhost:6000/receiveMoney', {
                        toUser,
                        amount
                    });

                    res.status(200).json({ message: `Successfully sent ${amount} to ${toUser} on Tigo Pesa`, receiverResponse: response.data });
                } catch (err) {
                    
                    dbMpesa.query('UPDATE users SET balance = balance + ? WHERE name = ?', [amount, fromUser], () => {
                        res.status(500).json({ message: 'Error updating Tigo Pesa balance, transaction rolled back' });
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


    dbMpesa.query('UPDATE users SET balance = balance + ? WHERE name = ?', [amount, toUser], (err) => {
        if (err) {
            return res.status(500).json({ message: 'Error updating receiver balance in M-Pesa' });
        }
        res.status(200).json({ message: `Received ${amount} successfully` });
    });
});

app.listen(5000, () => {
    console.log('M-Pesa API running on port 5000');
});
