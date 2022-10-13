function capitalize(string) {
    return string
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function convertSize(giffySize) {
    return giffySize.substring(0,3);
}

function convertType(giffyType) {

}

function getMonsterLanguages(giffyLanguages) {
    const languageArray = giffyLanguages.map(language => language.name)

    return languageArray
}

module.exports = {
    capitalize,
    convertSize,
    convertType,
    getMonsterLanguages
}