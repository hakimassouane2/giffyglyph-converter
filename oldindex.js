'use strict';

const fs = require('fs')
const utils = require('./utils/utils')
const currentProcessArgs = process.argv.slice(2);

const pathToFile = currentProcessArgs[0]
const pathToExport = currentProcessArgs[1]

if (!pathToFile) {
    console.error("ERROR : Path to giffyglyph JSON file was not setup")
    return ;
} else if (!pathToExport) {
    console.error("ERROR : Path where to export the end JSON file was not setup")
    return ;
}

const rawdata = fs.readFileSync(pathToFile)
const parsedData = JSON.parse(rawdata)


if (!parsedData) {
    console.error("ERROR : Giffyglpyh monster JSON file couldn't be loaded")
    return ;
}

const giffyMonster = parsedData.monster.blueprint

console.log("--- Giffyglyph monster loaded, starting convertion ---\n\n")

const exportMonster = {
    name: giffyMonster.description.name,
    type: "npc",
    data: {
        details: {
            alignment: utils.capitalize(giffyMonster.description.alignment),
            race: "",
            type: giffyMonster.description.type,
            cr: giffyMonster.description.level,
            source: "Giffyglpyh"
        },
        traits: {
            size: utils.convertSize(giffyMonster.description.size),
            // Immunities
            di: {
                value: [],
                custom: "",
            },
            // Resistances
            dr: {
                value: [],
                custom: ""
            },
            // Vulnerabilities
            dv: {
                value: [],
                custom: ""
            },
            // Condition Immunity
            ci: {
                value: [],
                custom: ""
            },
            languages: {
                value: utils.getMonsterLanguages(giffyMonster.languages),
                custom: ""
            },
        },
        currency: {
            pp: 0,
            gp: 0,
            ep: 0,
            sp: 0,
            cp: 0
        },
    },
    sort: 100000,
    flags: {},
    img: "",
    token: {},
    items: [],
    effects: []
}

console.log(exportMonster)

let exportData = JSON.stringify(exportMonster);
fs.writeFileSync('./exportedMonster.json', exportData);



