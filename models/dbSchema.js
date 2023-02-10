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
        unique: [true, "email already existed"],
        validate: {
            validator: function (v) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: '{VALUE} is not a valid email!'
        }
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
        ref: "cartSchema"
    }
});

const paymentSchema = mongoose.Schema({
    cxm:{
        type: String
    },
    cxid:{
        type:mongoose.Schema.Types.ObjectId,
        ref: "userid"
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
    }
})

const cartSchema = mongoose.Schema({
    buyerid:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "userid"
    },
    buyerm:{
        type: String
    },
    cart:[{
        item:{type: String},
        itemid: {type: mongoose.Schema.Types.ObjectId,
                ref: "classSchema"}
    }]
})

// export model user with UserSchema
users = mongoose.model("users", userSchema)
roles = mongoose.model("roles", roleSchema)
classes = mongoose.model("classes", classSchema)
carts = mongoose.model("carts", cartSchema)
payments = mongoose.model("payms", paymentSchema)

module.exports = { users, roles, classes, carts, payments }