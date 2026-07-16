module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      function replaceImportMetaEnv({ types: t }) {
        return {
          name: 'replace-import-meta-env',
          visitor: {
            MemberExpression(path) {
              const modeExpression = path.node;
              const envExpression = modeExpression.object;
              const importMetaExpression = envExpression?.object;
              const mode = process.env.NODE_ENV || 'development';

              if (
                t.isIdentifier(modeExpression.property, { name: 'MODE' }) &&
                t.isMemberExpression(envExpression) &&
                t.isIdentifier(envExpression.property, { name: 'env' }) &&
                t.isMetaProperty(importMetaExpression) &&
                importMetaExpression.meta.name === 'import' &&
                importMetaExpression.property.name === 'meta'
              ) {
                path.replaceWith(t.stringLiteral(mode));
                return;
              }

              if (
                t.isIdentifier(modeExpression.property, { name: 'env' }) &&
                t.isMetaProperty(modeExpression.object) &&
                modeExpression.object.meta.name === 'import' &&
                modeExpression.object.property.name === 'meta'
              ) {
                path.replaceWith(
                  t.objectExpression([
                    t.objectProperty(
                      t.identifier('MODE'),
                      t.stringLiteral(mode)
                    ),
                  ])
                );
              }
            },
          },
        };
      },
    ],
  };
};
