const fs = require('fs');

exports.getProvider = nodes => {
    const x = Math.floor(Math.random() * nodes.length);

    return nodes[x];
};

exports.isAboveMaxDepth = timestamp => {
    return timestamp < Date.now() && Date.now() - parseInt(timestamp) < 11 * 60 * 1000;
};

exports.updateAtPath = (filePath, list) => {
    const file = fs.createWriteStream(filePath);
    file.on('error', err => {
        throw new Error(err);
    });

    list.forEach(v => file.write(v + '\n'));
    file.end();
};

exports.setupFiles = (filePaths, callback) => {
  filePaths.forEach((file, idx) => {
      fs.exists(file, (exists) => {
          const isLast = idx === filePaths.length - 1;
          if (!exists) {
              fs.closeSync(fs.openSync(file, 'w'));

              if (isLast) {
                  callback();
              }
          } else {
              if (isLast) {
                  callback();
              }
          }
      })
  });
};

exports.getExistingData = filePath => {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
            if (err) {
                reject(err);
            }

            const res = data ? data.toString().split('\n') : [];
            resolve(res);
        });
    });

};

exports.union = (firstArr, secondArr) => firstArr.concat(secondArr.filter((item) => {
    return firstArr.indexOf(item) < 0;
}));
