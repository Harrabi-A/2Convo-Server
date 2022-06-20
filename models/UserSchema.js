const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema(
    {
        publicKey: {
            type: String,
            required: true,
        },
        socketID: {
            type: String,
            required: true,
        },
        convoCode: {
            type: String,
            required: true,
        }

    },
    { timestamps: true }
)

const User = mongoose.model('User', userSchema);
module.exports = User;
