#! /usr/bin/env node

/** @returns {string} */
const generateUUID = (function () {
    'use strict'
  
    var a = 0,
      b = []
    return function () {
      var c = new Date().getTime() + 0,
        d = c === a
      a = c
      for (var e = new Array(8), f = 7; 0 <= f; f--) {
        e[f] = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'.charAt(c % 64)
        c = Math.floor(c / 64)
      }
      c = e.join('')
      if (d) {
        for (f = 11; 0 <= f && 63 === b[f]; f--) {
          b[f] = 0
        }
        b[f]++
      } else {
        for (f = 0; 12 > f; f++) {
          b[f] = Math.floor(64 * Math.random())
        }
      }
      for (f = 0; 12 > f; f++) {
        c += '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'.charAt(b[f])
      }
      return c
    }
  })()
  
  const generateRowID = () => {
    'use strict'
    return generateUUID().replace(/_/g, 'Z')
  }
  
  const GGMM_VERSION_ID = 1
  
  /**
   * Unofficial Roll20 import script for GiffyGlyph's Monster Maker
   * https://giffyglyph.com/monstermaker/
   *
   * Script by @ianjsikes
   */
  
  const GGMM = {
    /**
     * @param {string} str
     * @returns {string}
     */
    caps: (str) => str.slice(0, 1).toUpperCase() + str.slice(1),
    /**
     * @param {{
     *  rating: string;
     *  custom: {
     *    rating: string | null;
     *    proficiency: number | null;
     *    xp: number | null;
     *  }
     * }} challenge
     * @returns {number}
     */
    challengeToProficiency: (challenge) => {
      if (challenge.rating === 'custom') {
        return challenge.custom.proficiency
      }
      if (challenge.rating.includes('/')) return 2
      let cr = parseInt(challenge.rating)
      if (cr === 0) return 2
      return Math.floor((cr - 1) / 4) + 2
    },
    /**
     * @param {string} expr
     * @returns {number}
     */
    evalMath: (expr) => {
      return Math.floor(Function(`"use strict";return (${expr})`)())
    },
    /**
     * @param {number} num
     * @param {number} die
     * @returns {string}
     */
    getDice: (num, die) => {
      let avg = die / 2 + 0.5
  
      let numDice = Math.floor(num / avg)
      if (numDice * avg === num) {
        return `${numDice}d${die}`
      }
  
      return `${numDice}d${die} + ${Math.round(num - numDice * avg)}`
    },
    /**
     * @param {GGMMMonster} monster
     * @param {string} shortcode
     * @returns {string}
     */
    parseShortcode: (monster, shortcode) => {
      let expr = shortcode
      let die = null
  
      // Check for the random die syntax [hp, d4]
      let matches = shortcode.match(/(.*)\, ?d(\d+)$/)
      if (matches) {
        expr = matches[1]
        die = parseInt(matches[2])
      }
  
      let [_, code] = expr.match(/[^a-z\-]*([a-z\-]+)[^a-z\-]*/) || []
      if (!code) {
        throw new Error(`Unable to parse ${shortcode}`)
      }
  
      let getVal = (code) => {
        if (code === 'level') return monster.level
        if (code.startsWith('attack')) return monster.attack
        if (code === 'damage') return monster.damage
        if (code === 'ac') return monster.ac
        if (code === 'hp') return monster.hp
        if (code.startsWith('dc-primary')) return monster.dcs[0]
        if (code.startsWith('dc-secondary')) return monster.dcs[0]
        if (code === 'xp') return monster.xp
        if (code === 'proficiency') return monster.proficiencyBonus
        if (code === 'cr') return monster.challengeRating
        if (code.endsWith('-mod')) {
          let stat = code.slice(0, 3)
          return Math.floor((monster.abilityScores[stat] - 10) / 2)
        }
        if (code.endsWith('-score')) {
          let stat = code.slice(0, 3)
          return monster.abilityScores[stat]
        }
        if (code.endsWith('-save')) {
          let stat = code.slice(0, 3)
          return monster.savingThrows[stat]
        }
      }
      let val = getVal(code)
      if (val === undefined) {
        throw new Error(`Unable to parse ${shortcode}`)
      }
  
      let computedExpr = GGMM.evalMath(expr.replace(code, val))
      if (computedExpr === undefined || computedExpr === null || isNaN(computedExpr)) {
        throw new Error(`Unable to parse ${shortcode}`)
      }
  
      let str = `${computedExpr}`
      if (code === 'attack') {
        str = `${computedExpr < 0 ? '-' : '+'}${str}`
      }
      if (code === 'dc-primary' || code === 'dc-secondary') {
        str = `DC ${str}`
      }
  
      if (die !== null) {
        str = `${str} (${GGMM.getDice(computedExpr, die)})`
      }
      return str
    },
    /**
     * @param {GGMMMonster} monster
     * @param {string} text
     * @returns {string}
     */
    parseText: (monster, text) => {
      if (!text) return ''
      return text.replace(/\[[^\[\]]+\]/g, (substr) => {
        try {
          return GGMM.parseShortcode(monster, substr.slice(1, -1))
        } catch (error) {
          return substr
        }
      })
    },
  }
  
  class GGMMMonster {
    /**
     * @param {object} data
     */
    constructor(data) {
      if (data.vid !== GGMM_VERSION_ID) {
        throw new Error(
          `Giffyglyph Monster Maker schema version mismatch. Expected ${GGMM_VERSION_ID}, found ${data.vid}`
        )
      }
      this.data = data
    }
  
    get quickstart() {
      return this.data.method === 'quickstart'
    }
  
    /** @returns {string} */
    get name() {
      let d = this.data.description
      return d.name
    }
  
    /** @returns {string} */
    get size() {
      return this.data.description.size
    }
  
    get tags() {
      return this.data.tags
    }
  
    /** @returns {string} */
    get type() {
      return this.data.description.type
    }
  
    /** @returns {string} */
    get alignment() {
      return this.data.description.alignment
    }
  
    /** @returns {string} */
    get level() {
      return this.data.description.level
    }
  
    /** @returns {string} */
    get role() {
      return this.data.description.role
    }
  
    /** @returns {string} */
    get rank() {
      return this.data.description.rank
    }
  
    /** @returns {string | null} */
    get image() {
      return this.data.display.image.url
    }
  
    /** @returns {[number, number]} */
    get dcs() {
      const bonus = GGMM_DATA.ranks[this.rank].spellDCs
      return GGMM_DATA.statsByLevel[this.level].spellDCs.map((dc) => dc + bonus)
    }
  
    /** @returns {number | null} */
    get attack() {
      if (!this.quickstart) return null
      return (
        GGMM_DATA.statsByLevel[this.level].attack + GGMM_DATA.roles[this.role].attack + GGMM_DATA.ranks[this.rank].attack
      )
    }
  
    /** @returns {number | null} */
    get damage() {
      if (!this.quickstart) return null
      return Math.round(
        GGMM_DATA.statsByLevel[this.level].damage * GGMM_DATA.roles[this.role].damage * GGMM_DATA.ranks[this.rank].damage
      )
    }
  
    /** @returns {number} */
    get ac() {
      if (this.quickstart) {
        return (
          GGMM_DATA.statsByLevel[this.level].ac +
          GGMM_DATA.ranks[this.rank].ac +
          GGMM_DATA.roles[this.role].ac +
          (this.data.ac.modifier || 0)
        )
      }
  
      return this.data.ac.base || 0
    }
  
    /** @returns {string | null} */
    get acType() {
      return this.data.ac.type
    }
  
    /** @returns {number} */
    get hp() {
      if (this.quickstart) {
        let hitpoints = GGMM_DATA.statsByLevel[this.level].hp * GGMM_DATA.roles[this.role].hp
        if (this.rank === 'solo') {
          hitpoints *= this.data.description.players || 4
          hitpoints /= this.data.description.phases || 1
        } else {
          hitpoints *= GGMM_DATA.ranks[this.rank].hp
        }
        hitpoints += this.data.hp.modifier
        hitpoints = Math.floor(hitpoints)
        return hitpoints
      }
  
      return this.data.hp.average || 0
    }
  
    /** @returns {string | null} */
    get hpFormula() {
      if (this.rank === 'solo') {
        let hp = Math.floor(
          (GGMM_DATA.statsByLevel[this.level].hp * GGMM_DATA.roles[this.role].hp) / (this.data.description.phases || 1)
        )
        return `${hp} per player`
      }
      return this.data.hp.roll
    }
  
    /** @returns {{ normal: string; burrow: string; climb: string; fly: string; swim: string; other: string}[]} */
    get speed() {
      return this.data.speed
    }
  
    /** @returns {{ str: number; dex: number; con: number; int: number; wis: number; cha: number; }} */
    get abilityScores() {
      if (this.quickstart) {
        let scores = GGMM_DATA.statsByLevel[this.level].abilityModifiers.reduce((obj, mod, idx) => {
          let score = mod * 2 + 10
          let abilityName = this.data.abilities.quickstart[idx].ability
          return { ...obj, [abilityName]: score }
        }, {})
        return scores
      }
  
      return {
        str: this.data.abilities.str,
        dex: this.data.abilities.dex,
        con: this.data.abilities.con,
        int: this.data.abilities.int,
        wis: this.data.abilities.wis,
        cha: this.data.abilities.cha,
      }
    }
  
    /** @returns {{ str: number; dex: number; con: number; int: number; wis: number; cha: number; }} */
    get savingThrows() {
      let scores = this.abilityScores
      if (this.quickstart) {
        let savesByLevel = GGMM_DATA.statsByLevel[this.level].savingThrows.map(
          (num) => num + GGMM_DATA.roles[this.role].savingThrows + GGMM_DATA.ranks[this.rank].savingThrows
        )
        let saves = {}
        saves[this.data.savingThrows.quickstart[0].ability] = savesByLevel[0]
        saves[this.data.savingThrows.quickstart[1].ability] = savesByLevel[1]
        saves[this.data.savingThrows.quickstart[2].ability] = savesByLevel[1]
        saves[this.data.savingThrows.quickstart[3].ability] = savesByLevel[2]
        saves[this.data.savingThrows.quickstart[4].ability] = savesByLevel[2]
        saves[this.data.savingThrows.quickstart[5].ability] = savesByLevel[2]
        return saves
      }
  
      return this.data.savingThrows.manual.reduce((obj, { ability }, idx) => {
        let mod = Math.floor((scores[ability] - 10) / 2)
        return { ...obj, [ability]: mod + 2 }
      }, {})
    }
  
    /** @returns {number} */
    get proficiencyBonus() {
      if (this.quickstart) return GGMM_DATA.statsByLevel[this.level].proficiencyBonus
  
      return GGMM.challengeToProficiency(this.data.challenge)
    }
  
    /** @returns {number} */
    get xp() {
      if (this.quickstart) return GGMM_DATA.statsByLevel[this.level].xp
    }
  
    /** @returns {{ [key: string]: number }} */
    get skills() {
      let scores = this.abilityScores
      if (this.quickstart) {
        let data = {}
        const prof = GGMM_DATA.statsByLevel[this.level].proficiencyBonus
        for (const skill of this.data.skills) {
          let name
          let score
          if (skill.custom.name) {
            name = skill.custom.name
            score = scores[skill.custom.ability]
          } else {
            name = skill.name
            score = scores[GGMM_DATA.skillToStat[name]]
          }
  
          let mod = Math.floor((score - 10) / 2)
          data[name] = mod + (skill.proficiency === 'expertise' ? 2 * prof : prof)
  
          if (name === 'stealth') {
            data[name] += GGMM_DATA.ranks[this.rank].stealth
          } else if (name === 'perception') {
            data[name] += GGMM_DATA.ranks[this.rank].perception
          }
        }
  
        const role = GGMM_DATA.roles[this.role]
        if (data['stealth'] === undefined) {
          data['stealth'] =
            GGMM_DATA.statsByLevel[this.level].initiative + GGMM_DATA.ranks[this.rank].stealth + (role.stealth ? prof : 0)
        }
        if (data['perception'] === undefined) {
          data['perception'] =
            GGMM_DATA.statsByLevel[this.level].initiative +
            GGMM_DATA.ranks[this.rank].perception +
            (role.perception ? prof : 0)
        }

        console.log('skills', data)
  
        return data
      }
  
      let data = {}
      for (const skill of this.data.skills) {
        let name
        let score
        if (skill.custom.name) {
          name = skill.custom.name
          score = scores[skill.custom.ability]
        } else {
          name = skill.name
          score = scores[GGMM_DATA.skillToStat[name]]
        }
  
        let mod = Math.floor((score - 10) / 2)
        data[name] = mod * (skill.proficiency === 'expertise' ? 2 : 1)
      }
      return data
    }
  
    /** @returns {number} */
    get initiative() {
      if (this.quickstart) {
        const { initiative, proficiencyBonus } = GGMM_DATA.statsByLevel[this.level]
        return (
          initiative +
          GGMM_DATA.ranks[this.rank].initiative +
          (GGMM_DATA.roles[this.role].initiative ? proficiencyBonus : 0)
        )
      }
  
      return this.abilityScores.dex
    }
  
    /** @returns {object} */
    get damageVulnerabilities() {
        const damageVulnerabilities = {
            value: this.data.vulnerabilities.map((vulnerability) => vulnerability.type),
            custom: ""
        }
        return damageVulnerabilities
    }
  
    /** @returns {object} */
    get damageResistances() {  
        const damageResistances = {
            value: this.data.resistances.map((resistance) => resistance.type),
            custom: ""
        }
        return damageResistances
    }
  
    /** @returns {object} */
    get damageImmunities() {
        const damageImmunities = {
            value: this.data.immunities.map((immunity) => immunity.type),
            custom: ""
        }
        return damageImmunities
    }
  
    /** @returns {object} */
    get conditionImmunities() {
        const conditionImmunities = {
            value: this.data.conditions.map((condition) => condition.type),
            custom: ""
        }
        return conditionImmunities
    }
  
    /** @returns {object} */
    get senses() {
        //TO DO : parse each field, check if not null, parse only numbers and delete ft
        return {}
        // return this.data.senses
    }
  
    /** @returns {string} */
    get languages() {
        const languages = {
            value: this.data.languages.map((language) => language.name),
            custom: ""
        }

        return languages
    }
  
    /** @returns {string} */
    get challengeRating() {
      if (this.quickstart) {
        return GGMM_DATA.mlToCr[this.rank][this.level]
      }
      if (this.data.challenge.rating === 'custom') {
        return this.data.challenge.custom.rating
      }
      return this.data.challenge.rating
    }
  
    /** @returns {{ name: string; detail: string }[]} */
    get traits() {
      let traits = [...this.data.traits]
  
      if (this.rank === 'solo') {
        if (this.data.description.phases > 1) {
          traits.unshift({
            name: `Phase Transition (Transformation)`,
            detail: `When reduced to 0 hit points, remove all on-going effects on yourself as you transform and start a new phase transition event.`,
          })
        } else {
          traits.unshift({
            name: `Phase Transition`,
            detail: `At 66% and 33% hit points, you may remove all on-going effects on yourself and start a new phase transition event.`,
          })
        }
      }
  
      let paragonActions = this.paragonActions
      if (paragonActions !== 0) {
        traits.unshift({
          name: `Paragon Actions`,
          detail: `You may take ${
            paragonActions === 'players' ? 'one Paragon Action per player (minus 1)' : `${paragonActions} Paragon Action`
          } per round to either move or act.`,
        })
      }
  
      traits.unshift({
        name: `Level ${this.level} ${GGMM.caps(this.rank)} ${GGMM.caps(this.role)}`,
        detail: `Attack: [attack], Damage: [damage]
  Attack DCs: Primary [dc-primary], Secondary [dc-secondary]`,
      })
  
      return traits.map((trait) => {
        return {
          name: trait.name,
          detail: GGMM.parseText(this, trait.detail),
        }
      })
    }
  
    /** @returns {{ name: string; detail: string }[]} */
    get actions() {
      return this.data.actions.map((action) => {
        return {
          name: action.name,
          detail: GGMM.parseText(this, action.detail),
        }
      })
    }
  
    /** @returns {number | "players"} */
    get paragonActions() {
      if (!this.quickstart) return 0
      if (this.data.paragonActions.type === 'custom') {
        return this.data.paragonActions.amount
      }
  
      if (this.rank === 'elite') {
        return 1
      }
  
      if (this.rank === 'solo') {
        return 'players'
      }
  
      return 0
    }
  
    /** @returns {{ name: string; detail: string }[]} */
    get reactions() {
      return this.data.reactions.map((reaction) => {
        return {
          name: reaction.name,
          detail: GGMM.parseText(this, reaction.detail),
        }
      })
    }
  
    /** @returns {number | null} */
    get legendaryActionsPerRound() {
      return this.data.legendaryActionsPerRound
    }
  
    /** @returns {{ name: string; detail: string }[]} */
    get legendaryActions() {
      return this.data.legendaryActions.map((action) => {
        return {
          name: action.name,
          detail: GGMM.parseText(this, action.detail),
        }
      })
    }
  
    /** @returns {number | null} */
    get lairActionsInitiative() {
      return this.data.lairActionsInitiative
    }
  
    /** @returns {{ name: string; detail: string }[]} */
    get lairActions() {
      return this.data.lairActions.map((action) => {
        return {
          name: action.name,
          detail: GGMM.parseText(this, action.detail),
        }
      })
    }
  
    /** @returns {string | null} */
    get note() {
      return (this.data.notes[0] || {}).detail
    }
  }
  
  const fs = require('fs')
  const path = require('path')
  
  const options = {
    pro: false,
  }
  
  const main = async () => {
    let filepath = path.resolve(process.cwd(), process.argv[2])
    const file = fs.readFileSync(filepath, 'utf8')
    let data = JSON.parse(file)
    let monsterDataArr = []
  
    if (!data.blueprint && !data.monster && !data.vault) {
      throw new Error('Invalid JSON structure')
    }
  
    if (data.blueprint) {
      monsterDataArr = [data.blueprint]
    } else if (data.monster) {
      monsterDataArr = [data.monster.blueprint]
    } else if (data.vault) {
      monsterDataArr = data.vault.map((m) => m.blueprint)
    }
  
    for (const monsterData of monsterDataArr) {
      createMonster(monsterData, path.dirname(filepath))
    }
  }
  
  let createMonster = (monsterData, outputPath) => {
    let char = new GGMMMonster(monsterData)
  
    let exportMonster = {
        "_id": generateUUID(),
        "name": char.name,
        "type": "npc",
        "data": {
          "abilities": {
            "str": {
              "value": char.abilityScores.str,
              "proficient": 1,
            },
            "dex": {
              "value": char.abilityScores.dex,
              "proficient": 1,
            },
            "con": {
              "value": char.abilityScores.con,
              "proficient": 1,
            },
            "int": {
              "value": char.abilityScores.int,
              "proficient": 1,
            },
            "wis": {
              "value": char.abilityScores.wis,
              "proficient": 1,
            },
            "cha": {
              "value": char.abilityScores.cha,
              "proficient": 1,
            }
          },
          "attributes": {
            "ac": {
              "value": char.ac,
              "min": 0,
              "formula": "natural armor"
            },
            "hp": {
              "value": char.hp,
              "max": char.hp,
            },
            // "movement": {
            //   "burrow": char.speed.burrow || 0,
            //   "climb": char.speed.climb || 0,
            //   "fly": char.speed.fly || 0,
            //   "swim": char.speed.swim || 0,
            //   "walk": char.speed.normal || 0,
            //   "units": "ft",
            //   "hover": false
            // },
            "spellcasting": "int",
            "prof": 5,
            "bar1": {
              "value": char.hp,
              "min": 0,
              "max": char.hp
            },
            "bar2": {
              "value": 16,
              "min": 0,
              "max": 0
            },
            "senses": char.senses,
          },
          // Details DONE (except biography of NPC)
          "details": {
            "biography": {
              "value": "Picture: <a class=\"entity-link\" data-entity=JournalEntry data-id=OTg0YTc0OWQ4ZmMw ><i class=\"fas fa-book-open\"></i>Handout: Strahd von Zarovich<br></a><br><h2>Strahd von Zarovich</h2>With his mind sharp and his heart dark, Strahd von Zarovich is a formidable foe. Courage and lives beyond measure have been lost to him. See <a class=\"entity-link\" data-entity=JournalEntry data-id=YWI3NzNiZWE4OGE2 ><i class=\"fas fa-book-open\"></i>Strahd's History</a> to understand his personality and goals.<br><br>Although Strahd can be encountered almost anywhere in his domain, the vampire is always encountered in the place indicated by the card reading in chapter 1, unless he has been forced into his tomb in the catacombs of Castle Ravenloft.<br><br>\n<hr><section class=\"secret\"><p><strong>GM Notes :</strong> </p><h3>Strahd’s Tactics</h3>Because the entire adventure revolves around Strahd, you must play him intelligently and do everything you can to make him a terrifying and cunning adversary for the player characters.<br><br>When you run an encounter with Strahd, keep the following facts in mind:<br><br><ul><li>Strahd attacks at the most advantageous moment and from the most advantageous position.</li><li>Strahd knows when he’s in over his head. If he begins taking more damage than he can regenerate, he moves beyond the reach of melee combatants and spellcasters, or he flies away (using summoned wolves or swarms of bats or rats to guard his retreat).</li><li>Strahd observes the characters to see who among them are most easily swayed, then tries to charm characters who have low Wisdom scores and use them as thralls. At the very least, he can order a charmed character to guard him against other members of the adventuring party.</li></ul><br><h3>The Vampire’s Minions</h3>Whenever Strahd appears in a location other than his tomb or the place indicated by the card reading, roll a d20 and consult the Strahd’s Minions table to determine what creatures he brings with him, if any.<br><br><h4>Strahd’s Minions</h4><table cellspacing=\"0\" cellpadding=\"0\" style=\"font-size: 13px\"><tbody><tr><td valign=\"top\"><strong>d20</strong></td><td valign=\"top\"><strong>Creatures</strong></td></tr><tr><td valign=\"top\">1–3</td><td valign=\"top\">1d4 + 2 <strong><a class=\"entity-link\" data-entity=Actor data-id=Y2U1NjM4N2M0ZDgw ><i class=\"fas fa-user\"></i>dire wolves</a></strong></td></tr><tr><td valign=\"top\">4–6</td><td valign=\"top\">1d6 + 3 <strong><a class=\"entity-link\" data-entity=Actor data-id=ZjEwNjY5MTM3YjE2 ><i class=\"fas fa-user\"></i>ghouls</a></strong></td></tr><tr><td valign=\"top\">7–9</td><td valign=\"top\">1d4 + 2 <strong><a class=\"entity-link\" data-entity=Actor data-id=ODM2ODk3OGYwN2Nl ><i class=\"fas fa-user\"></i>Strahd zombies</a></strong> </td></tr><tr><td valign=\"top\">10–12 </td><td valign=\"top\">2d4 <strong><a class=\"entity-link\" data-entity=Actor data-id=NjVhZTI3NTMzNjMz ><i class=\"fas fa-user\"></i>swarms of bats</a></strong></td></tr><tr><td valign=\"top\">13–15 </td><td valign=\"top\">1d4 + 1 <strong><a class=\"entity-link\" data-entity=Actor data-id=YWM4NmJjYmJiMGE1 ><i class=\"fas fa-user\"></i>vampire spawn</a></strong></td></tr><tr><td valign=\"top\">16–18 </td><td valign=\"top\">3d6 <strong><a class=\"entity-link\" data-entity=Actor data-id=MWM2Nzc5NjRiZTQy ><i class=\"fas fa-user\"></i>wolves</a></strong></td></tr><tr><td valign=\"top\">19–20 </td><td valign=\"top\">None</td></tr></tbody></table><br>If the characters are in a residence, Strahd’s creatures break through doors and windows to reach them, or crawl up through the earth, or swoop down the chimney. The vampire spawn (all that’s left of a party of adventurers that Strahd defeated long ago) can’t enter the characters’ location unless invited.<br><br><h3>Heart of Sorrow</h3>Strahd can afford to be bold in his tactics, for he has additional protection in the form of a giant crystal heart hidden inside Castle Ravenloft.<br><br>Any damage that Strahd takes is transferred to the Heart of Sorrow (see chapter 4, <a class=\"entity-link\" data-entity=JournalEntry data-id=ZmU0Yjk2NzNiY2U4 ><i class=\"fas fa-book-open\"></i>area K20</a>). If the heart absorbs damage that reduces it to 0 hit points, it is destroyed, and Strahd takes any leftover damage. The Heart of Sorrow has 50 hit points and is restored to that number of hit points each dawn, provided it has at least 1 hit point remaining. Strahd can, as a bonus action on his turn, break his link to the Heart of Sorrow so that it no longer absorbs damage dealt to him. Strahd can reestablish his link to the Heart of Sorrow as a bonus action on his turn, but only while in Castle Ravenloft.<br><br>The effect of the protection afforded by the Heart of Sorrow can be chilling to behold, as damage to Strahd is quickly undone. For example, a critical hit might dislocate Strahd’s jaw, but only for a moment; then the vampire’s jaw quickly resets itself.<br><br>The ability of the Heart of Sorrow to absorb damage is suppressed if it or Strahd is fully within an <em>antimagic field</em>.<br><br><h3>Lair Actions</h3>While Strahd is in Castle Ravenloft, he can take lair actions as long as he isn’t incapacitated.<br><br>On initiative count 20 (losing initiative ties), Strahd can take one of the following lair action options, or forgo using any of them in that round:<br><br><ul><li>Until initiative count 20 of the next round, Strahd can pass through solid walls, doors, ceilings, and floors as if they weren’t there.</li><li>Strahd targets any number of doors and windows that he can see, causing each one to either open or close as he wishes. Closed doors can be magically locked (needing a successful DC 20 Strength check to force open) until Strahd chooses to end the effect, or until Strahd uses this lair action again.</li><li>Strahd summons the angry spirit of one who has died in the castle. The apparition appears next to a hostile creature that Strahd can see, makes an attack against that creature, and then disappears. The apparition has the statistics of a <strong><a class=\"entity-link\" data-entity=Actor data-id=OTJmMjVhNzNlOWY0 ><i class=\"fas fa-user\"></i>specter</a></strong>.</li><li>Strahd targets one Medium or smaller creature that casts a shadow. The target’s shadow must be visible to Strahd and within 30 feet of him. If the target fails a DC 17 Charisma saving throw, its shadow detaches from it and becomes a <strong><a class=\"entity-link\" data-entity=Actor data-id=ZWZkNWI3YTE5NmE4 ><i class=\"fas fa-user\"></i>shadow</a></strong> that obeys Strahd’s commands, acting on initiative count 20. A <em>greater restoration</em> spell or a <em>remove curse</em> spell cast on the target restores its natural shadow, but only if its undead shadow has been destroyed.</li></ul></section>",
              "public": ""
            },
            "alignment": char.alignment,
            "race": "",
            "type": char.type,
            "environment": "",
            "cr": char.level,
            "spellLevel": 0,
            "xp": {
              "value": 0
            },
            "source": "Giffyglyph",
            "class": " 1",
          },
          // Traits DONE
          "traits": {
            "size": char.size,
            "di": char.damageImmunities,
            "dr": char.damageResistances,
            "dv": char.damageVulnerabilities,
            "ci": char.conditionImmunities,
            "languages": char.languages
          },
          // Currency DONE
          "currency": {
            "pp": 0,
            "gp": 0,
            "ep": 0,
            "sp": 0,
            "cp": 0
          },
          "skills": {
              // value 0 = Pas de maitrise, 1 = maitrise, 2 = expertise
              // Handle proficiency through basic GGMM object
            "acr": {
              "value": 0,
              "ability": "dex",
              "bonus": 0,
              "mod": 4,
              "passive": 14,
              "prof": 0,
              "total": 14
            },
            "ani": {
              "value": 0,
              "ability": "cha",
              "bonus": 15,
              "mod": 15,
              "passive": 15,
              "prof": 15,
              "total": 15
            },
            "arc": {
                "value": 1,
                "ability": "int",
                "bonus": 0,
                "mod": 5,
                "passive": 25,
                "prof": 10,
                "total": 15
              },
            "ath": {
              "value": 0,
              "ability": "str",
              "bonus": 0,
              "mod": 4,
              "passive": 14,
              "prof": 0,
              "total": 4
            },
            "dec": {
              "value": 0,
              "ability": "cha",
              "bonus": 0,
              "mod": 4,
              "passive": 14,
              "prof": 0,
              "total": 4
            },
            "his": {
              "value": 0,
              "ability": "int",
              "bonus": 0,
              "mod": 5,
              "passive": 15,
              "prof": 0,
              "total": 5
            },
            "ins": {
              "value": 0,
              "ability": "wis",
              "bonus": 0,
              "mod": 2,
              "passive": 12,
              "prof": 0,
              "total": 2
            },
            "itm": {
              "value": 0,
              "ability": "cha",
              "bonus": 0,
              "mod": 4,
              "passive": 14,
              "prof": 0,
              "total": 4
            },
            "inv": {
              "value": 0,
              "ability": "int",
              "bonus": 0,
              "mod": 5,
              "passive": 15,
              "prof": 0,
              "total": 5
            },
            "med": {
              "value": 0,
              "ability": "wis",
              "bonus": 0,
              "mod": 2,
              "passive": 12,
              "prof": 0,
              "total": 2
            },
            "nat": {
              "value": 0,
              "ability": "int",
              "bonus": 0,
              "mod": 5,
              "passive": 15,
              "prof": 0,
              "total": 5
            },
            "prc": {
              "value": 1,
              "ability": "wis",
              "bonus": 0,
              "mod": 2,
              "passive": 22,
              "prof": 10,
              "total": 12
            },
            "prf": {
              "value": 0,
              "ability": "cha",
              "bonus": 0,
              "mod": 4,
              "passive": 14,
              "prof": 0,
              "total": 4
            },
            "per": {
              "value": 0,
              "ability": "cha",
              "bonus": 0,
              "mod": 4,
              "passive": 14,
              "prof": 0,
              "total": 4
            },
            "rel": {
              "value": 1,
              "ability": "int",
              "bonus": 0,
              "mod": 5,
              "passive": 20,
              "prof": 5,
              "total": 10
            },
            "slt": {
              "value": 0,
              "ability": "dex",
              "bonus": 0,
              "mod": 4,
              "passive": 14,
              "prof": 0,
              "total": 4
            },
            "ste": {
              "value": 1,
              "ability": "dex",
              "bonus": 0,
              "mod": 4,
              "passive": 24,
              "prof": 10,
              "total": 14
            },
            "sur": {
              "value": 0,
              "ability": "wis",
              "bonus": 0,
              "mod": 2,
              "passive": 12,
              "prof": 0,
              "total": 2
            }
          },
          "bonuses": {
            // Melee weapon attack
            "mwak": {
              "attack": "",
              "damage": ""
            },
            // Range weapon attack
            "rwak": {
              "attack": "",
              "damage": ""
            },
            // Melee spell attack
            "msak": {
              "attack": "",
              "damage": ""
            },
            // Ranged spell attack
            "rsak": {
              "attack": "",
              "damage": ""
            },
            "abilities": {
              "check": "",
              "save": "",
              "skill": ""
            },
            "spell": {
              "dc": ""
            }
          },
          "resources": {
            "legact": {
              "value": 6,
              "max": 6
            },
            "legres": {
              "value": 3,
              "max": 3
            },
            "lair": {
              "value": true,
              "initiative": 20
            }
          }
        },
        "sort": 100000,
        "img": "",
        // TODO
        "token": {
          "name": char.name,
          "displayName": 20,
          "img": "pc/Groupe%20fran%C3%A7ais/StrahdHigher_Vampire_2_4.Token.png?1609051751801",
          "tint": "",
          "width": 1,
          "height": 1,
          "scale": 1,
          "mirrorX": false,
          "mirrorY": false,
          "lockRotation": false,
          "rotation": 0,
          "vision": true,
          "dimSight": 125,
          "brightSight": 125,
          "dimLight": 0,
          "brightLight": 0,
          "sightAngle": 360,
          "lightAngle": 360,
          "lightColor": "",
          "lightAlpha": 1,
          "lightAnimation": {
            "type": "",
            "speed": 5,
            "intensity": 5
          },
          "actorId": "zrFIF5jhDs8mEQex",
          "actorLink": false,
          "disposition": -1,
          "displayBars": 20,
          "bar1": {
            "attribute": "attributes.hp"
          },
          "randomImg": false
        },
        // TODO
        "items": [
          {
            "_id": "ZmEzZTQ2NDdkNzIy",
            "name": "Unarmed Strike",
            "type": "weapon",
            "data": {
              "description": {
                "value": "<p><strong>Unarmed Strike (Vampire Form Only).</strong><em>Melee Weapon Attack: </em>+7, Reach 5 ft., one target. <em>Hit : 11</em>&nbsp;(1d8 + 4) bludgeoning damage plus 14 (4d6) necrotic damage.</p>\n<p>If the target is a creature, Strahd can grapple it (escape DC 18) instead of dealing the bludgeoning damage.</p>",
                "chat": "",
                "unidentified": ""
              },
              "source": "",
              "quantity": 1,
              "weight": 1,
              "price": 0,
              "equipped": true,
              "rarity": "",
              "identified": true,
              "activation": {
                "type": "action",
                "cost": 1,
                "condition": ""
              },
              "duration": {
                "value": 0,
                "units": ""
              },
              "target": {
                "value": null,
                "width": null,
                "units": "",
                "type": ""
              },
              "range": {
                "value": 5,
                "long": null,
                "units": "ft"
              },
              "uses": {
                "value": 0,
                "max": 0,
                "per": ""
              },
              "consume": {
                "type": "",
                "target": "",
                "amount": null
              },
              "ability": "str",
              "actionType": "mwak",
              "attackBonus": -2,
              "chatFlavor": "",
              "critical": null,
              "damage": {
                "parts": [
                  [
                    "1d4+1",
                    "bludgeoning"
                  ],
                  [
                    "1d6",
                    "necrotic"
                  ]
                ],
                "versatile": ""
              },
              "formula": "",
              "save": {
                "ability": "",
                "dc": null,
                "scaling": "spell"
              },
              "armor": {
                "value": 10
              },
              "hp": {
                "value": 0,
                "max": 0,
                "dt": null,
                "conditions": ""
              },
              "weaponType": "natural",
              "properties": {
                "amm": false,
                "hvy": false,
                "fin": false,
                "fir": false,
                "foc": false,
                "lgt": false,
                "rch": false,
                "rel": false,
                "ret": false,
                "spc": false,
                "thr": false,
                "two": false,
                "ver": false,
                "lod": false
              },
              "proficient": true,
              "attunement": 0
            },
            "sort": 260000,
            "flags": {
              "mess": {
                "templateTexture": ""
              }
            },
            "img": "https://wow.zamimg.com/images/wow/icons/large/inv_relics_totemofrage.jpg",
            "effects": []
          },
          {
            "_id": "NDI2NjRmNDE4ZmMw",
            "name": "Charm",
            "type": "feat",
            "data": {
              "description": {
                "value": "<p><p><strong>Charm.</strong>.</p><p>Strahd targets one humanoid he can see within 30 feet of him. If the target can see Strahd, the target must succeed on a DC 17 Wisdom saving throw against this magic or be charmed. The charmed target regards Strahd as a trusted friend to be heeded and protected. The target isn’t under Strahd’s control, but it takes Strahd’s requests and actions in the most favorable way and lets Strahd bite it.</p><p></p><p>Each time Strahd or his companions do anything harmful to the target, it can repeat the saving throw, ending the effect on itself on a success. Otherwise, the effect lasts 24 hours or until Strahd is destroyed, is on a different plane of existence than the target, or takes a bonus action to end the effect.</p></p>",
                "chat": "",
                "unidentified": ""
              },
              "source": "",
              "activation": {
                "type": "action",
                "cost": 1,
                "condition": ""
              },
              "duration": {
                "value": 0,
                "units": ""
              },
              "target": {
                "value": null,
                "width": null,
                "units": "",
                "type": ""
              },
              "range": {
                "value": null,
                "long": null,
                "units": ""
              },
              "uses": {
                "value": 0,
                "max": 0,
                "per": ""
              },
              "consume": {
                "type": "",
                "target": "",
                "amount": null
              },
              "ability": "",
              "actionType": "",
              "attackBonus": 0,
              "chatFlavor": "",
              "critical": null,
              "damage": {
                "parts": [],
                "versatile": ""
              },
              "formula": "",
              "save": {
                "ability": "wis",
                "dc": 18,
                "scaling": "spell"
              },
              "requirements": "",
              "recharge": {
                "value": 0,
                "charged": false
              }
            },
            "sort": 280000,
            "flags": {
              "mess": {
                "templateTexture": ""
              }
            },
            "img": "icons/Spell_Shadow_Charm.png",
            "effects": []
          }
        ],
        "effects": []
    }
  
    let newPath = path.join(outputPath, `GGMM_${char.name}.json`)
    fs.writeFileSync(newPath, JSON.stringify(exportMonster, null, 2), 'utf8')
  }
  
  const GGMM_DATA = {
    skillToStat: {
      acrobatics: 'dex',
      'animal handling': 'wis',
      arcana: 'int',
      athletics: 'str',
      deception: 'cha',
      history: 'int',
      insight: 'wis',
      intimidation: 'cha',
      investigation: 'int',
      medicine: 'wis',
      nature: 'int',
      perception: 'wis',
      performance: 'cha',
      persuasion: 'cha',
      religion: 'int',
      'sleight of hand': 'dex',
      stealth: 'dex',
      survival: 'wis',
    },
    ranks: {
      minion: {
        ac: -1,
        attack: -2,
        hp: 0.2,
        damage: 0.75,
        savingThrows: -2,
        spellDCs: -2,
        initiative: -2,
        perception: -2,
        xp: 0.25,
        stealth: -2,
      },
      standard: {
        ac: 0,
        attack: 0,
        hp: 1,
        damage: 1,
        savingThrows: 0,
        spellDCs: 0,
        initiative: 0,
        perception: 0,
        xp: 1,
        stealth: 0,
      },
      elite: {
        ac: 2,
        attack: 2,
        hp: 2,
        damage: 1.1,
        savingThrows: 2,
        spellDCs: 2,
        initiative: 2,
        perception: 2,
        xp: 2,
        stealth: 2,
      },
      solo: {
        ac: 2,
        attack: 2,
        hp: 'players',
        damage: 1.2,
        savingThrows: 2,
        spellDCs: 2,
        initiative: 4,
        perception: 4,
        xp: 'players',
        stealth: 2,
      },
    },
    roles: {
      controller: {
        ac: -2,
        savingThrows: -1,
        hp: 1,
        attack: 0,
        damage: 1,
        speed: 0,
        perception: false,
        stealth: false,
        initiative: true,
      },
      defender: {
        ac: 2,
        savingThrows: 1,
        hp: 1,
        attack: 0,
        damage: 1,
        speed: -10,
        perception: true,
        stealth: false,
        initiative: false,
      },
      lurker: {
        ac: -4,
        savingThrows: -2,
        hp: 0.5,
        attack: 2,
        damage: 1.5,
        speed: 0,
        perception: true,
        stealth: true,
        initiative: false,
      },
      scout: {
        ac: -2,
        savingThrows: -1,
        hp: 1,
        attack: 0,
        damage: 0.75,
        speed: 10,
        perception: true,
        stealth: true,
        initiative: true,
      },
      sniper: {
        ac: 0,
        savingThrows: 0,
        hp: 0.75,
        attack: 0,
        damage: 1.25,
        speed: 0,
        perception: false,
        stealth: true,
        initiative: false,
      },
      striker: {
        ac: -4,
        savingThrows: -2,
        hp: 1.25,
        attack: 2,
        damage: 1.25,
        speed: 0,
        perception: false,
        stealth: false,
        initiative: false,
      },
      supporter: {
        ac: -2,
        savingThrows: -1,
        hp: 0.75,
        attack: 0,
        damage: 0.75,
        speed: 0,
        perception: false,
        stealth: false,
        initiative: true,
      },
    },
    statsByLevel: {
      '−5': {
        ac: 11,
        hp: 1,
        attack: -1,
        damage: 1,
        spellDCs: [8, 5],
        initiative: 0,
        proficiencyBonus: 0,
        savingThrows: [1, 0, -1],
        abilityModifiers: [1, 0, 0, 0, 0, -1],
        xp: 0,
      },
      '−4': {
        ac: 12,
        hp: 1,
        attack: 0,
        damage: 1,
        spellDCs: [9, 6],
        initiative: 1,
        proficiencyBonus: 0,
        savingThrows: [2, 1, -1],
        abilityModifiers: [2, 1, 1, 0, 0, -1],
        xp: 0,
      },
      '−3': {
        ac: 13,
        hp: 4,
        attack: 1,
        damage: 1,
        spellDCs: [10, 7],
        initiative: 1,
        proficiencyBonus: 1,
        savingThrows: [3, 1, 0],
        abilityModifiers: [2, 1, 1, 0, 0, -1],
        xp: 2,
      },
      '−2': {
        ac: 13,
        hp: 8,
        attack: 1,
        damage: 1,
        spellDCs: [10, 7],
        initiative: 1,
        proficiencyBonus: 1,
        savingThrows: [3, 1, 0],
        abilityModifiers: [2, 1, 1, 0, 0, -1],
        xp: 6,
      },
      '−1': {
        ac: 13,
        hp: 12,
        attack: 1,
        damage: 1,
        spellDCs: [10, 7],
        initiative: 1,
        proficiencyBonus: 1,
        savingThrows: [3, 1, 0],
        abilityModifiers: [2, 1, 1, 0, 0, -1],
        xp: 12,
      },
      0: {
        ac: 14,
        hp: 16,
        attack: 2,
        damage: 1,
        spellDCs: [10, 7],
        initiative: 1,
        proficiencyBonus: 1,
        savingThrows: [4, 2, 0],
        abilityModifiers: [3, 2, 1, 1, 0, -1],
        xp: 25,
      },
      1: {
        ac: 14,
        hp: 26,
        attack: 3,
        damage: 2,
        spellDCs: [11, 8],
        initiative: 1,
        proficiencyBonus: 2,
        savingThrows: [5, 3, 0],
        abilityModifiers: [3, 2, 1, 1, 0, -1],
        xp: 50,
      },
      2: {
        ac: 14,
        hp: 30,
        attack: 3,
        damage: 4,
        spellDCs: [11, 8],
        initiative: 1,
        proficiencyBonus: 2,
        savingThrows: [5, 3, 0],
        abilityModifiers: [3, 2, 1, 1, 0, -1],
        xp: 112,
      },
      3: {
        ac: 14,
        hp: 33,
        attack: 3,
        damage: 5,
        spellDCs: [11, 8],
        initiative: 1,
        proficiencyBonus: 2,
        savingThrows: [5, 3, 0],
        abilityModifiers: [3, 2, 1, 1, 0, -1],
        xp: 175,
      },
      4: {
        ac: 15,
        hp: 36,
        attack: 4,
        damage: 8,
        spellDCs: [12, 9],
        initiative: 2,
        proficiencyBonus: 2,
        savingThrows: [6, 3, 1],
        abilityModifiers: [4, 3, 2, 1, 1, 0],
        xp: 275,
      },
      5: {
        ac: 16,
        hp: 60,
        attack: 5,
        damage: 10,
        spellDCs: [13, 10],
        initiative: 2,
        proficiencyBonus: 3,
        savingThrows: [7, 4, 1],
        abilityModifiers: [4, 3, 2, 1, 1, 0],
        xp: 450,
      },
      6: {
        ac: 16,
        hp: 64,
        attack: 5,
        damage: 11,
        spellDCs: [13, 10],
        initiative: 2,
        proficiencyBonus: 3,
        savingThrows: [7, 4, 1],
        abilityModifiers: [4, 3, 2, 1, 1, 0],
        xp: 575,
      },
      7: {
        ac: 16,
        hp: 68,
        attack: 5,
        damage: 13,
        spellDCs: [13, 10],
        initiative: 2,
        proficiencyBonus: 3,
        savingThrows: [7, 4, 1],
        abilityModifiers: [4, 3, 2, 1, 1, 0],
        xp: 725,
      },
      8: {
        ac: 17,
        hp: 72,
        attack: 6,
        damage: 17,
        spellDCs: [14, 11],
        initiative: 3,
        proficiencyBonus: 3,
        savingThrows: [8, 5, 1],
        abilityModifiers: [5, 3, 2, 2, 1, 0],
        xp: 975,
      },
      9: {
        ac: 18,
        hp: 102,
        attack: 7,
        damage: 19,
        spellDCs: [15, 12],
        initiative: 3,
        proficiencyBonus: 4,
        savingThrows: [9, 5, 2],
        abilityModifiers: [5, 3, 2, 2, 1, 0],
        xp: 1250,
      },
      10: {
        ac: 18,
        hp: 107,
        attack: 7,
        damage: 21,
        spellDCs: [15, 12],
        initiative: 3,
        proficiencyBonus: 4,
        savingThrows: [9, 5, 2],
        abilityModifiers: [5, 3, 2, 2, 1, 0],
        xp: 1475,
      },
      11: {
        ac: 18,
        hp: 111,
        attack: 7,
        damage: 23,
        spellDCs: [15, 12],
        initiative: 3,
        proficiencyBonus: 4,
        savingThrows: [9, 5, 2],
        abilityModifiers: [5, 3, 2, 2, 1, 0],
        xp: 1800,
      },
      12: {
        ac: 18,
        hp: 115,
        attack: 8,
        damage: 28,
        spellDCs: [15, 12],
        initiative: 3,
        proficiencyBonus: 4,
        savingThrows: [10, 6, 2],
        abilityModifiers: [6, 4, 3, 2, 1, 0],
        xp: 2100,
      },
      13: {
        ac: 19,
        hp: 152,
        attack: 9,
        damage: 30,
        spellDCs: [16, 13],
        initiative: 3,
        proficiencyBonus: 5,
        savingThrows: [11, 7, 2],
        abilityModifiers: [6, 4, 3, 2, 1, 0],
        xp: 2500,
      },
      14: {
        ac: 19,
        hp: 157,
        attack: 9,
        damage: 32,
        spellDCs: [16, 13],
        initiative: 3,
        proficiencyBonus: 5,
        savingThrows: [11, 7, 2],
        abilityModifiers: [6, 4, 3, 2, 1, 0],
        xp: 2875,
      },
      15: {
        ac: 19,
        hp: 162,
        attack: 9,
        damage: 35,
        spellDCs: [16, 13],
        initiative: 3,
        proficiencyBonus: 5,
        savingThrows: [11, 7, 2],
        abilityModifiers: [6, 4, 3, 2, 1, 0],
        xp: 3250,
      },
      16: {
        ac: 20,
        hp: 167,
        attack: 10,
        damage: 41,
        spellDCs: [17, 14],
        initiative: 4,
        proficiencyBonus: 5,
        savingThrows: [12, 7, 3],
        abilityModifiers: [7, 5, 3, 2, 2, 1],
        xp: 3750,
      },
      17: {
        ac: 21,
        hp: 210,
        attack: 11,
        damage: 43,
        spellDCs: [18, 15],
        initiative: 4,
        proficiencyBonus: 6,
        savingThrows: [13, 8, 3],
        abilityModifiers: [7, 5, 3, 2, 2, 1],
        xp: 4500,
      },
      18: {
        ac: 21,
        hp: 216,
        attack: 11,
        damage: 46,
        spellDCs: [18, 15],
        initiative: 4,
        proficiencyBonus: 6,
        savingThrows: [13, 8, 3],
        abilityModifiers: [7, 5, 3, 2, 2, 1],
        xp: 5000,
      },
      19: {
        ac: 21,
        hp: 221,
        attack: 11,
        damage: 48,
        spellDCs: [18, 15],
        initiative: 4,
        proficiencyBonus: 6,
        savingThrows: [13, 8, 3],
        abilityModifiers: [7, 5, 3, 2, 2, 1],
        xp: 5500,
      },
      20: {
        ac: 22,
        hp: 226,
        attack: 12,
        damage: 51,
        spellDCs: [19, 16],
        initiative: 5,
        proficiencyBonus: 6,
        savingThrows: [14, 9, 3],
        abilityModifiers: [8, 6, 4, 3, 2, 1],
        xp: 6250,
      },
      21: {
        ac: 22,
        hp: 276,
        attack: 13,
        damage: 53,
        spellDCs: [20, 17],
        initiative: 5,
        proficiencyBonus: 7,
        savingThrows: [15, 9, 4],
        abilityModifiers: [8, 6, 4, 3, 2, 1],
        xp: 8250,
      },
      22: {
        ac: 22,
        hp: 282,
        attack: 13,
        damage: 56,
        spellDCs: [20, 17],
        initiative: 5,
        proficiencyBonus: 7,
        savingThrows: [15, 9, 4],
        abilityModifiers: [8, 6, 4, 3, 2, 1],
        xp: 10250,
      },
      23: {
        ac: 22,
        hp: 288,
        attack: 13,
        damage: 58,
        spellDCs: [20, 17],
        initiative: 5,
        proficiencyBonus: 7,
        savingThrows: [15, 9, 4],
        abilityModifiers: [8, 6, 4, 3, 2, 1],
        xp: 12500,
      },
      24: {
        ac: 23,
        hp: 294,
        attack: 14,
        damage: 61,
        spellDCs: [20, 17],
        initiative: 5,
        proficiencyBonus: 7,
        savingThrows: [16, 10, 4],
        abilityModifiers: [9, 6, 4, 3, 2, 1],
        xp: 15500,
      },
      25: {
        ac: 24,
        hp: 350,
        attack: 15,
        damage: 63,
        spellDCs: [21, 18],
        initiative: 5,
        proficiencyBonus: 8,
        savingThrows: [17, 11, 4],
        abilityModifiers: [9, 6, 4, 3, 2, 1],
        xp: 18750,
      },
      26: {
        ac: 24,
        hp: 357,
        attack: 15,
        damage: 66,
        spellDCs: [21, 18],
        initiative: 5,
        proficiencyBonus: 8,
        savingThrows: [17, 11, 4],
        abilityModifiers: [9, 6, 4, 3, 2, 1],
        xp: 22500,
      },
      27: {
        ac: 24,
        hp: 363,
        attack: 15,
        damage: 68,
        spellDCs: [21, 18],
        initiative: 5,
        proficiencyBonus: 8,
        savingThrows: [17, 11, 4],
        abilityModifiers: [9, 6, 4, 3, 2, 1],
        xp: 26250,
      },
      28: {
        ac: 25,
        hp: 369,
        attack: 16,
        damage: 71,
        spellDCs: [22, 19],
        initiative: 6,
        proficiencyBonus: 8,
        savingThrows: [18, 11, 5],
        abilityModifiers: [10, 7, 5, 4, 3, 2],
        xp: 30000,
      },
      29: {
        ac: 26,
        hp: 432,
        attack: 17,
        damage: 73,
        spellDCs: [23, 20],
        initiative: 6,
        proficiencyBonus: 9,
        savingThrows: [19, 12, 5],
        abilityModifiers: [10, 7, 5, 4, 3, 2],
        xp: 33750,
      },
      30: {
        ac: 26,
        hp: 439,
        attack: 17,
        damage: 76,
        spellDCs: [23, 20],
        initiative: 6,
        proficiencyBonus: 9,
        savingThrows: [19, 12, 5],
        abilityModifiers: [10, 7, 5, 4, 3, 2],
        xp: 38750,
      },
      31: {
        ac: 26,
        hp: 446,
        attack: 17,
        damage: 78,
        spellDCs: [23, 20],
        initiative: 6,
        proficiencyBonus: 9,
        savingThrows: [19, 12, 5],
        abilityModifiers: [10, 7, 5, 4, 3, 2],
        xp: 44500,
      },
      32: {
        ac: 26,
        hp: 453,
        attack: 18,
        damage: 81,
        spellDCs: [24, 21],
        initiative: 7,
        proficiencyBonus: 9,
        savingThrows: [20, 13, 5],
        abilityModifiers: [11, 8, 5, 4, 3, 2],
        xp: 51000,
      },
      33: {
        ac: 27,
        hp: 522,
        attack: 19,
        damage: 83,
        spellDCs: [25, 22],
        initiative: 7,
        proficiencyBonus: 10,
        savingThrows: [21, 13, 6],
        abilityModifiers: [11, 8, 5, 4, 3, 2],
        xp: 58750,
      },
      34: {
        ac: 27,
        hp: 530,
        attack: 19,
        damage: 86,
        spellDCs: [25, 22],
        initiative: 7,
        proficiencyBonus: 10,
        savingThrows: [21, 13, 6],
        abilityModifiers: [11, 8, 5, 4, 3, 2],
        xp: 67750,
      },
      35: {
        ac: 27,
        hp: 537,
        attack: 19,
        damage: 88,
        spellDCs: [25, 22],
        initiative: 7,
        proficiencyBonus: 10,
        savingThrows: [21, 13, 6],
        abilityModifiers: [11, 8, 5, 4, 3, 2],
        xp: 77750,
      },
    },
    mlToCr: {
      minion: {
        '-5': '0',
        '-4': '0',
        '-3': '0',
        '-2': '0',
        '-1': '0',
        0: '0',
        1: '1/8',
        2: '1/4',
        3: '1/2',
        4: '1/2',
        5: '1/2',
        6: '1/2',
        7: '1',
        8: '1',
        9: '1',
        10: '1',
        11: '2',
        12: '2',
        13: '2',
        14: '3',
        15: '3',
        16: '3',
        17: '4',
        18: '4',
        19: '4',
        20: '4',
        21: '5',
        22: '6',
        23: '7',
        24: '8',
        25: '9',
        26: '10',
        27: '10',
        28: '11',
        29: '12',
        30: '12',
      },
      standard: {
        '-5': '0',
        '-4': '0',
        '-3': '0',
        '-2': '0',
        '-1': '0',
        0: '1/8',
        1: '1/4',
        2: '1/2',
        3: '1',
        4: '1',
        5: '2',
        6: '2',
        7: '3',
        8: '4',
        9: '4',
        10: '4',
        11: '5',
        12: '5',
        13: '6',
        14: '7',
        15: '7',
        16: '8',
        17: '8',
        18: '9',
        19: '10',
        20: '11',
        21: '12',
        22: '13',
        23: '14',
        24: '15',
        25: '16',
        26: '17',
        27: '18',
        28: '19',
        29: '20',
        30: '21',
      },
      elite: {
        '-5': '0',
        '-4': '0',
        '-3': '0',
        '-2': '0',
        '-1': '1/8',
        0: '1/4',
        1: '1/2',
        2: '1',
        3: '2',
        4: '3',
        5: '3',
        6: '4',
        7: '4',
        8: '5',
        9: '6',
        10: '7',
        11: '7',
        12: '8',
        13: '9',
        14: '10',
        15: '10',
        16: '11',
        17: '12',
        18: '13',
        19: '14',
        20: '15',
        21: '16',
        22: '17',
        23: '18',
        24: '19',
        25: '20',
        26: '21',
        27: '22',
        28: '23',
        29: '24',
        30: '25',
      },
      solo: {
        '-5': '0',
        '-4': '0',
        '-3': '0',
        '-2': '1/8',
        '-1': '1/4',
        0: '1/2',
        1: '1',
        2: '2',
        3: '3',
        4: '4',
        5: '5',
        6: '6',
        7: '7',
        8: '8',
        9: '9',
        10: '10',
        11: '11',
        12: '12',
        13: '13',
        14: '14',
        15: '15',
        16: '16',
        17: '17',
        18: '18',
        19: '19',
        20: '20',
        21: '21',
        22: '22',
        23: '23',
        24: '24',
        25: '25',
        26: '26',
        27: '27',
        28: '28',
        29: '29',
        30: '30',
      },
    },
  }
  
  main().catch((err) => console.error(err))