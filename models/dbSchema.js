//model schema for user and class and role

const mongoose = require("mongoose");

const roleSchema = mongoose.Schema({
    role: {
        type: String
    }
})

const classSchema = mongoose.Schema({
    classname: {
        type: String,
        required: true
    },
    instructor: {
        type: String,
        required: false
    },
    duration: {
        type: Number,
        required: false
    },
    price:{
        type: Number,
        default: 0.75
    },
    photo: {
        type: String,
        required: true
    }
})

const userSchema = mongoose.Schema({
    password: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        required: true
    },
    monPass: {
        type: Boolean,
        default: false
    },
    token:{
        type: String
    },
    cartid:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "carts"
    }
});

const paymentSchema = mongoose.Schema({
    cxname:{
        type: String
    },
    cxm:{
        type: String
    },
    cxid:{
        type:mongoose.Schema.Types.ObjectId,
        ref: "users"
    },
    paidList:[{
        item: String,
        itemid:{type: mongoose.Schema.Types.ObjectId, 
                ref: "classSchema"}
    }],
    date:{
        type: Date,
        default: Date.now
    },
    paymentNum:{
        type: Number
    },
    total:{
        type: Number
    }
})

const cartSchema = mongoose.Schema({
    buyerid:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
    },
    buyerm:{
        type: String
    },
    cart:[{
        item:{type: String},
        itemid: {type: mongoose.Schema.Types.ObjectId,
                ref: "classes"}
    }]
})

// export model user with all Schema
users = mongoose.model("users", userSchema)
roles = mongoose.model("roles", roleSchema)
classes = mongoose.model("classes", classSchema)
carts = mongoose.model("carts", cartSchema)
payments = mongoose.model("payms", paymentSchema)

module.exports = { users, roles, classes, carts, payments }