const fs = require('fs');

module.exports = {
  get(prop) {
    return new Promise((resolve, reject) => {
      fs.readFile(`${__dirname}/../storage/${prop}.list`, (err, data) => {
        if (err) {
          reject(err);
        }

        const res = data ? data.toString().split('\n').filter(str => str) : [];
        resolve(res);
      });
    });
  },
  set(prop, data) {
    return new Promise((resolve, reject) => {
      fs.writeFile(`${__dirname}/../storage/${prop}.list`, data.join('\n'), err => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  },
  update(prop, item) {
    return this.get(prop)
      .then(data => {
        if (data.includes(item)) {
          return Promise.resolve(data);
        }

        const updatedData = [...data, item];
        return this.set(prop, updatedData);
      });
  },
  delete(prop, item) {
    return this.get(prop)
      .then(data => {
        if (!data.includes(item)) {
          return Promise.resolve(data);
        }

        const updatedData = data.filter(value => value !== item);
        return this.set(prop, updatedData);
      });
  },
};
