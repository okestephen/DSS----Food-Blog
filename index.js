//Required Modules
const express = require('express');
const app = express();
const fs = require('fs');
var bodyParser = require('body-parser')
const {log} = require('console')


const PORT = 3000;

app.use(express.static(__dirname + "/public"));

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());


app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
