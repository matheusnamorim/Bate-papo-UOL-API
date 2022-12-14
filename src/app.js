import express from 'express';
import cors from  'cors';
import joi from 'joi';
import { MongoClient, ObjectId } from 'mongodb';
import dayjs from 'dayjs';
import {stripHtml} from 'string-strip-html';
import dotenv from 'dotenv';
dotenv.config();

const server = express();
server.use(express.json());
server.use(cors());

const mongoClient = new MongoClient(process.env.MONGO_URI); 
let db;

mongoClient.connect(() => {
    db = mongoClient.db('BatePapoUOL');
});

const userSchema = joi.object({
    name: joi.string().trim().required()
});

const userSchema2 = joi.object({
    to: joi.string().trim().required(),
    text: joi.string().trim().required(),
    type: joi.string().valid('message', 'private_message').required()
});

function sanitizeString(string){
    if(string){
        const str = stripHtml(string, {trimOnlySpaces: true}).result;
        return str;
    }
    return;
}

server.get('/participants', async (req,res) => {
    
    try {
        const arrayParticipants = await db.collection('participants').find().toArray();
        res.send(arrayParticipants);
    } catch (error) {
        res.status(500).send(error.message);
        return;
    }

});

server.post('/participants', async (req, res) => {

    const userName = sanitizeString(req.body.name);
    const validation = userSchema.validate({name: userName});

    if(validation.error) {
        const message = validation.error.details.map(value => value.message);
        res.status(422).send(message);
        return;
    }
    
    try {
        
        const arrayParticipants = await db.collection('participants').find().toArray();
        if(arrayParticipants.find(value => value.name === userName) !== undefined){
            res.sendStatus(409);
            return;
        }else{
            db.collection('participants').insertOne({name: userName, lastStatus: Date.now()});
            db.collection('messages').insertOne({
                from: userName, 
                to: 'Todos', 
                text: 'entra na sala...', 
                type: 'status', 
                time: dayjs().format('hh:mm:ss')})
            res.sendStatus(201);
            return;
        }
    } catch (error) {
        res.status(500).send(error.message);
        return;
    }
});

server.get('/messages', async (req, res) => {

    const { user } = req.headers;
    const { limit } = req.query;
    try {
        const arrayMessages = await db.collection('messages').find().toArray();

        const messagesFiltered = arrayMessages.filter(value => {
            if(value.type === 'private_message' && (value.from === user || value.to === user || value.to === 'Todos') || 
            value.type === 'message' || value.type === 'status')
                return value;
        });
        if(Number.isInteger(Number(limit))){
          let tam = messagesFiltered.length - limit;
          if(tam < 0) tam = 0;
          res.send(messagesFiltered.filter((value, index) => {
            if(index >= tam) {
                return value;
            }
        }));  
        }else 
            res.send(messagesFiltered);
    } catch (error) {
        res.status(500).send(error.message);
        return;
    }
});

server.post('/messages', async (req, res) => {
    
    const userName = sanitizeString(req.headers.user);
    const to = sanitizeString(req.body.to);
    const text = sanitizeString(req.body.text);
    const type = sanitizeString(req.body.type);

    const validation = userSchema2.validate({to, text, type}, { abortEarly: false });

    if(validation.error){
        const message = validation.error.details.map(value => value.message);
        res.status(422).send(message);
        return;
    }
    try {
        const arrayParticipants = await db.collection('participants').find().toArray();
        if(arrayParticipants.find(value => value.name === userName) === undefined) {
            res.sendStatus(422);
            return;
        }
        db.collection('messages').insertOne({
            from: userName, 
            to: to,
            text: text,
            type: type,
            time: dayjs().format('HH:mm:ss')
        });
        res.sendStatus(201);
        return;
    } catch (error) {
        res.status(500).send(error.message);
        return;
    }
});

server.post('/status', async (req, res) => {
    const userName = sanitizeString(req.headers.user);
    try {
        const arrayParticipants = await db.collection('participants').find().toArray();
        if(arrayParticipants.find(value => value.name === userName) === undefined){
            res.sendStatus(404);
            return;
        }
        db.collection('participants').updateOne({name: userName}, {$set: {lastStatus: Date.now()}});
        res.sendStatus(200);
        return;
    } catch (error) {
        res.status(500).send(error.message);
        return;
    }
});

setInterval(async function(){
    const list = await db.collection('participants').find().toArray();
    list.forEach(element => {
        if(element.lastStatus < (Date.now()-10000)){
            db.collection('participants').deleteOne({name: element.name});
            db.collection('messages').insertOne({
                from: element.name, 
                to: 'Todos', 
                text: 'sai da sala...', 
                type: 'status', 
                time: dayjs().format('HH:mm:ss'
                )}
            )
        }
    });
}, 15000);

server.delete('/messages/:id', async(req, res) => {
    const { id } = req.params;
    const userName = sanitizeString(req.headers.user);

    try {
        const message = await db.collection('messages').findOne({_id: new ObjectId(id)});
        if(!message){
            res.sendStatus(404);
            return;
        }else{
            if(userName !== message.from){
                res.sendStatus(401);
                return;
            }
            db.collection('messages').deleteOne({_id: new ObjectId(id)});
            res.sendStatus(200);
            return;
        }

    } catch (error) {
        res.status(500).send(error.message);
        return;
    }
});

server.put('/messages/:id', async(req, res) => {
    const { id } = req.params;
    const userName = sanitizeString(req.headers.user);
    const to = sanitizeString(req.body.to);
    const text = sanitizeString(req.body.text);
    const type = sanitizeString(req.body.type);
    
    const validation = userSchema2.validate({to, text, type}, { abortEarly: false });
    if(validation.error){
        const message = validation.error.details.map(value => value.message);
        res.status(422).send(message);
        return;
    }
    try {
        const participants = await db.collection('participants').findOne({name: userName});
        if(!participants){
            res.sendStatus(422);
            return;
        }
        const message = await db.collection('messages').findOne({_id: new ObjectId(id)});
        if(!message){
            res.sendStatus(404);
            return;
        }else{
            if(userName !== message.from){
                res.sendStatus(401);
                return;
            }
            db.collection('messages').updateOne({_id: new ObjectId(id)}, {$set: {
                to: to,
                text: text,
                type: type
            }});
            res.sendStatus(200);
            return;
        }
    } catch (error) {
        res.status(500).send(error.message);
        return;
    }
});

server.listen(5000, () => console.log('Listening on port 5000'));