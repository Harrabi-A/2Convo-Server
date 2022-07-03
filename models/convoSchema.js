const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const convoSchema = new Schema(
    {
        socket1: {
            type: String,
            required: true,
        },
        socket2: {
            type: String,
            required: true,
        }
    },
    { timestamp: true }
)

const Convo = mongoose.model('Convo', convoSchema);
module.exports= Convo;