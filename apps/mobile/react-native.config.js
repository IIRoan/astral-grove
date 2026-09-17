// Registers in-repo native modules with React Native autolinking. A Nitro module is
// linked through the RN CLI rather than Expo's autolinking, so it has to be named here.
module.exports = {
  dependencies: {
    'card-ocr-frame': {
      root: __dirname + '/modules/card-ocr-frame',
    },
  },
};
