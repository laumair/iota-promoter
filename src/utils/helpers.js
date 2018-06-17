exports.isAboveMaxDepth = timestamp => {
  return timestamp < Date.now() &&
    Date.now() - parseInt(timestamp) < 11 * 60 * 1000; // eslint-disable-line radix
};

exports.union = (firstArr, secondArr) => firstArr.concat(secondArr.filter((item) => {
  return firstArr.indexOf(item) < 0;
}));
