import express from 'express';
import cors from  'cors';
import joi from 'joi';
import { MongoClient } from 'mongodb';
import dayjs from 'dayjs';
import dotenv from 'dotenv';
dotenv.config();

const server = express();
server.use(express.json());
server.use(cors());

const mongoClient = new MongoClient(process.env.MONGO_URI); 
let db;

mongoClient.connect(() => {
    db = mongoClient.db('BateBapoUOL');
});

const userSchema = joi.object({
    name: joi.string().min(1).required()
});

server.get('/participants', async (req,res) => {
    
    let arrayParticipants = [];
    try {
        arrayParticipants = await db.collection('participants').find().toArray();
        arrayParticipants.map(value => delete value._id);
        res.send(arrayParticipants);
    } catch (error) {
        res.status(500).send(error.message);
        return;
    }

});

server.post('/participants', async (req, res) => {

    let arrayParticipants = [];
    const body = req.body;
    const validation = userSchema.validate(body);

    if(validation.error) {
        const message = validation.error.details.map(value => value.message);
        res.status(422).send(message);
        return;
    }

    try {
        arrayParticipants = await db.collection('participants').find().toArray();
    } catch (error) {
        res.status(500).send(error.message);
        return;
    }

    if(arrayParticipants.find(value => value.name === req.body.name) !== undefined){
        res.sendStatus(409);
        return;
    }else{
        db.collection('participants').insertOne({name: req.body.name, lastStatus: Date.now()});
        db.collection('messages').insertOne({
            from: req.body.name, 
            to: 'Todos', 
            text: 'entra na sala...', 
            type: 'status', 
            time: dayjs().format('hh:mm:ss')})
        res.sendStatus(201);
        return;
    }
    
});

server.get('/messages', async (req, res) => {
    const { limit } = req.query;
    try {
        const arrayMessages = await db.collection('messages').find().toArray();
        arrayMessages.map(value => delete value._id);

        if(Number.isInteger(Number(limit))){
          let tam = arrayMessages.length - limit;
          if(tam < 0) tam = 0;
          res.send(arrayMessages.filter((value, index) => {if(index >= tam) return value;}));  
        }else 
            res.send(arrayMessages);
    } catch (error) {
        res.status(500).send(error.message);
        return;
    }
});

server.listen(5000, () => console.log('Listening on port 5000'));