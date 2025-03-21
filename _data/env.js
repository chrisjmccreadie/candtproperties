let todaysDate = new Date();
let _YEAR = todaysDate.getFullYear();

const commonConfig = {
  YEAR: _YEAR,
};

const envConfigs = {
  local: {
    ...commonConfig,
    ENVIRONMENT: "local",
    CMSURL: "http://localhost:4321/api/v1/",
  },
  production: {
    ...commonConfig,
    ENVIRONMENT: "production",
    CMSURL: "https://cms.orbitlabs.xyz/api/v1/",
  },
};

module.exports = (env) => {
  return envConfigs[env] || envConfigs.local;
};
