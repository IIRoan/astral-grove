// Registers in-repo native modules with React Native autolinking. Expo's own
// autolinking picks up `modules/card-ocr` (an Expo module) on its own; a Nitro
// module is linked through the RN CLI instead, so it has to be named here.
module.exports = {
  dependencies: {
    'card-ocr-frame': {
      root: __dirname + '/modules/card-ocr-frame',
    },
  },
};
