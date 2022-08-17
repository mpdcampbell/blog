tsParticles.load("leftDucks", {
      particles: {
    number: {
      value: 10,
      limit:0,
      density: {
	enable: true,
	value_area: 400
      }
    },
    color: {
      value: "#ffffff"
    },
    shape: {
      type: "image",
      stroke: {
        width: 2,
        color: "#fff"
      },
      image: [{
	src: "https://error.codeslikeaduck.com/images/leftCodeDuck.png",
        width: 64,
        height: 64
      }],
    },
    opacity: {
      value: 1,
    },
    size: {
      value: 16,
    },
    move: {
      enable: true,
      speed: 5,
      direction: "left",
      random: true,
      straight: false,
      collisions: false,
      outModes: 
      {
        default:"bounce",
        top:"bounce",
        left:"out",
        right:"out",
        bottom:"bounce"
      },
      bounce: true,
    },
  },
  retina_detect: true
});

tsParticles.load("rightDucks", {
      particles: {
    number: {
    value: 10,
    limit:0,
    density: {
      enable: true,
      value_area: 400
      }
    },
    color: {
      value: "#ffffff"
    },
    shape: {
      type: "image",
      stroke: {
        width: 2,
        color: "#fff"
      },
      image: [{
	src: "https://error.codeslikeaduck.com/images/rightCodeDuck.png",
        width: 64,
        height: 64
      }],
    },
    opacity: {
      value: 1,
    },
    size: {
      value: 16,
    },
    move: {
      enable: true,
      speed: 5,
      direction: "right",
      random: true,
      straight: false,
      collisions: false,
      outModes: 
      {
        default:"bounce",
        top:"bounce",
        left:"out",
        right:"out",
        bottom:"bounce"
      },
      bounce: true,
    },
  },
  retina_detect: true
});
