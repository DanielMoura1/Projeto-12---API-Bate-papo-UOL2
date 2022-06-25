import 'dotenv/config'
import express, { text } from 'express';
import cors from 'cors';
import axios from 'axios'; 
import chalk from 'chalk';
import joi from 'joi';
import { MongoClient,ObjectId } from "mongodb";
import dayjs from"dayjs";




const app = express();
app.use(express.json());
app.use(cors());

const mongoClient = new MongoClient(process.env.mongo_conect);
let db;
const conexao = mongoClient.connect();


conexao.then(()=>{
    db = mongoClient.db("batepapo-uol");
    console.log('Banco de dados conectado')

})
app.post('/participants',async (req, res) => {
    const nome = req.body;
    const userSchema = joi.object({
        name: joi.string().required(),
      });
    const {error} = userSchema.validate(nome)
    if(error){
        console.log(error)
        return res.status(422).send('nome não tá legal  -_-')
    }
    try{
       
      
        const nomee = await db.collection("participants").findOne({name:nome.name})
       
        if(nomee){
            console.log('ja tem esse nome')
            return res.sendStatus(409)
        }
        await db.collection("participants").insertOne({name:nome.name,lastStatus: Date.now()})
        await db.collection("messages").insertOne({
            from: nome.name, 
            to: 'Todos', 
            text: 'entra na sala...', 
            type: 'status', 
            time: dayjs().format('HH:mm:SS')
        });
        
        res.sendStatus(201); 
    }  catch(e){
        console.log('deu ruim no nome')
        return res.status(500).send('erro ao registrar')
       
    }
  
});
app.get("/participants",async (req,res) =>{
    try{
        const participants = await db.collection("participants").find().toArray() 
	    res.send(participants); 
    } catch(e){
        console.log('deu ruim3')
        res.status(500) 
    } 
});
app.post('/messages',async (req, res) => {
    const mensagem = req.body;
    console.log(mensagem)
    const porFavorFunciona = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid('message','private_message').required()
      });
      const validar = porFavorFunciona.validate(mensagem)
      if(validar.error){
        return res.status(422).send('messages não tá legal  -_-');
    }
    const {user} =req.headers;
    try{
        const participants = await db.collection("participants").findOne({name:user});
        
        console.log(user)
        if(!participants){
            return res.sendStatus(422)
        }
        
        const {to,text,type} =mensagem;
        
        await db.collection("messages").insertOne({
            to,
            text,
            type,
            from: user,
            time: dayjs().format('HH:mm:SS')
        });
      
        res.sendStatus(201)
    } catch(e){
        console.log('deu ruim2')
        return res.status(420).send('voce nao existe')
       
    }
   
});
app.get("/messages",async (req,res) =>{
    const limit = parseInt(req.query.limit);
    const {user}=req.headers;
   try { 
        const messages = await db.collection("messages").find().toArray();
        const nmensages = messages.filter(massage =>{
            const {from,to,type}=massage;
            const toUser =to =='todos' || (to== user || from ==user);
            const ispublic =type =='message';
            return toUser || ispublic
        });
        if(limit && limit != NaN){
            return res.send(nmensages.slice(-limit))
        } 
        res.send(nmensages);
   } catch(e){
    console.log('deu ruim1??');
    res.sendStatus(500);
  
   }
});
app.post("/status", async (req,res) =>{
    const {user} = req.headers;
    
    try{
        
        const participants =await db.collection("participants").find({name:user});
       
        if(!participants){
            return res.sendStatus(404);
        }
        await db.collection("participants").updateOne({name:user},{$set:{lastStatus: Date.now()}});
        res.sendStatus(200);
    }catch(e){
        console.log('erro em atualizar status')
        return res.sendStatus(500)
    }
});
const tempo =15*1000;
setInterval(async () =>{
    const segundos =Date.now() - (10 * 1000);
    try{
        const participantesInativos =await db.collection("participants").find({ lastStatus: { $lte: segundos} }).toArray();
        if(participantesInativos.length>0){
            const mensagemInativa =participantesInativos.map(participanteInativo =>{
                return {
                    from: participanteInativo.name,
                    to: 'Todos',
                    text: 'sai da sala...',
                    type: 'status',
                    time: dayjs().format("HH:mm:ss")
                }
            })
            await db.collection("messages").insertMany(mensagemInativa);
            await db.collection("participants").deleteMany({ lastStatus: { $lte: segundos } });
        }
    }catch(e){
        console.log('erro inativo!')
        return res.sendStatus(500)
    }
},tempo);
app.delete("/messages/:id", async (req,res) =>{
    const id =req.params.id
    const {user} = req.headers;
    try{
    const mg =await db.collection("messages").find({_id:new ObjectId(id)}).toArray();
    if(!mg){
        console.log('_-')
        return  res.sendStatus(404)
    } 
    if(user !=mg[0].from){
        console.log(user+' + '+mg[0].from)
        return  res.sendStatus(401)
    }
    const mensagem = await db.collection("messages");
    await mensagem.deleteOne({ _id: new ObjectId(id) })
}catch(e){
    console.log('erro em apagar mensagem!')
    return res.sendStatus(500)
}
});
app.put("/messages/:id", async (req,res) =>{
    const bod = req.body;
    const {user} = req.headers;
    const id =req.params.id
    try{
    const mg =await db.collection("messages").find({_id:new ObjectId(id)}).toArray();
    if(!mg){
        console.log('_-')
        return  res.sendStatus(404)
    }
    if(user !=mg[0].from){
       console.log(user+' + '+mg[0].from)
       return  res.sendStatus(401)
    }
    const mensagem = await db.collection("messages");
    await  mensagem.updateOne({ 
        _id: new ObjectId(id) 
    }, { $set: { text: bod.text,
        time:dayjs().format('HH:mm:SS')} })
    }catch(e){
        console.log('erro em atualizar mensagem!')
        return res.sendStatus(500)
    }

});

app.listen(process.env.porta,() =>{
    console.log(chalk.bold.green('O servidor está em pé na porta :'+process.env.porta))
})