require('dotenv').config();

const express = require('express');
const app = express();
const cors = require("cors");
const http = require('http');
const {Server} = require('socket.io');

const morgan = require('morgan');
const mongoose = require('mongoose');
const User = require('./models/userSchema');
const Convo = require('./models/convoSchema')
const { text } = require('express');

app.use(cors());

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

var onlineList = []
var convoRequestList = []
var inConvoList = []
var nextCode = 1000        // minimum convo code

const server = http.createServer();

// Connect to Database
const URI = "mongodb+srv://"+process.env.DB_USERNAME+":"+process.env.DB_PASSWORD+"@cluster0.gajstln.mongodb.net/?retryWrites=true&w=majority"
mongoose.connect(URI)
   .then((result) => {
     console.log("Connected to DB");

     //Start listening only after server got a connection with database
     server.listen(process.env.PORT, () =>{
        console.log("Server Runing",process.env.PORT);
    
        // get the max ConvoID in DB to assure the uniqueness of new generated code
        User.findOne({}, {}, { sort: { 'socketID' : 1 } }, function(err, obj) {
            if (obj !== null){
                nextCode = parseInt(obj.toObject().convoCode);
                console.log("nextCode: ",nextCode)
            }
            console.log("Starting Convo code value: ",++nextCode)
        });
      } );
   })
   .catch((error) => {console.log(error)})

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  }, 
})

//User.findByIdAndDelete()

io.on("connection", (socket) => {
  console.log("SocketID: ",socket.id," Connected");

  socket.on("init", (key) => {
    //console.log(socket.id, ": ", key)
    const user = new User({publicKey: key, socketID: socket.id, convoCode: nextCode})
    
    var isUser = false;


    User.find({publicKey: key, socketID: socket.id})
       .then(result => {
        if (result.length === 0 ){
          // Insert new user
          user.save()
          .then(value => {nextCode++;})
          .catch(err => {
              console.log(err);
          });

      onlineList.push(user.convoCode);
      console.log("onLineList: ",onlineList)
      //Send Unique convo Code to user
      io.to(socket.id).emit("initResponse",nextCode)
        }
        });
    
    socket.on("requestConvo", (convoCode, convoRequested) => {
      const convoReq = convoCode.toString()+convoRequested.toString()
      if(onlineList.includes(convoRequested)){
        io.to(socket.id).emit("convoIDFound")
        // check a match request 
        console.log("the user ", convoCode, " requested a convo with existing user: ", convoRequested)  
        if (convoRequestList.includes(convoRequested.toString()+convoCode.toString())){
          var socketID1
          var socketID2
          // convo request match
          inConvoList.push(convoRequested+convoCode)
          convoRequestList.pop(convoRequested.toString()+convoCode.toString())
          //retrive socket

          var today= new Date();
          User.findOne({convoCode: convoCode})
            .then(obj => {
              console.log(obj.convoCode," convo code: ",convoCode," has socket: ",obj.socketID)
              
              // get the public key of convoer && save convo in database
              User.findOne({convoCode: convoRequested})
                 .then(obj1 => {
                   // save convo in Database
                   socketID1 = obj.socketID
                   socketID2 = obj1.socketID
                   const convo = new Convo({socket1: socketID1, socket2: socketID2})
                   convo.save()
                     .catch(err => {console.log(err)})
                   io.to(obj.socketID).emit("startConvo", convoRequested, today.toString(), obj1.publicKey)
                 })
            })
          
            User.findOne({convoCode: convoRequested})
            .then(obj => {
              console.log(obj.convoCode," convo code: ",convoRequested," has socket: ",obj.socketID)
              User.findOne({convoCode: convoCode})
                .then( obj1 => {
                  io.to(obj.socketID).emit("startConvo", convoCode, today.toString(), obj1.publicKey)
                } )            
            })
            
        } else {
          // register the request       
          convoRequestList.push(convoReq)
        }
      } else {
        io.to(socket.id).emit("convoIDNotFound")
      }
      socket.on("endWaiting", () => {
        convoRequestList.pop(convoReq)
      })
      console.log("inConvoList: ", inConvoList)
      console.log("convoRequestList: ", convoRequestList)
    })
    
    socket.on("sendMessage", (pleinText, pk) => {
      User.findOne({publicKey: pk})
        .then(obj => {
          io.to(obj.socketID).emit("newMessage", pleinText)
        })
    })

    

    socket.on("endConvo", () => {
      console.log("end convo recevied")
      Convo.findOneAndDelete({socket1: socket.id})
         .then(obj => {
           if(obj !== null){
               io.to(obj.socket2).emit("convoerDisconnected")
           }
         })
      Convo.findOneAndDelete({socket2: socket.id})
         .then(obj => {
           if(obj !== null){
               io.to(obj.socket1).emit("convoerDisconnected")
           }
         })
    })

    socket.on("disconnect", () => {
      console.log("User disconnect", socket.id)
      user.remove();
      onlineList.pop(user.convoCode)

      Convo.findOneAndDelete({socket1: socket.id})
         .then(obj => {
           if(obj !== null){
               io.to(obj.socket2).emit("convoerDisconnected")
           }
         })
      Convo.findOneAndDelete({socket2: socket.id})
         .then(obj => {
           if(obj !== null){
               io.to(obj.socket1).emit("convoerDisconnected")
           }
         })
    })
      
  });

  
})
