import { findKey, compact, keys, isFunction, mapValues, get } from 'lodash';
import { schema } from 'normalizr';

for (let key of ['Entity', 'Array', 'Object', 'Union', 'Values']) {
  schema[key].prototype.getType = () => key;
}
export const NormalizrSchema = schema;

class DefaultEntityBase {}

export default function ormGenerator(normalizrSchema, classExtensions, reduxStore = 'entities') {
  const selectors = {};
  const entityClasses = {};
  Object.keys(normalizrSchema).forEach(function (entityName) {
    const entity = normalizrSchema[entityName];
    const entityTableName = normalizrSchema[entityName].key;
    const associations = entity.schema;
    const EntityBase = classExtensions[entityName] || DefaultEntityBase;
    const entityType = entity.getType()

    function assiciationType(key) {
      return Array.isArray(associations[key]) ? 'Array' : associations[key].getType ? associations[key].getType() : null;
    }

    if (entityType === 'Union') {
      entityClasses[entityName] = class extends EntityBase {
        static getEntityType(value) {
          return entity._schemaAttribute(value);
        }
      }
    } else if (entityType === 'Entity') {

      var associationNamesToEntityNames = {};
  
      Object.keys(associations).forEach(name => {
        const type = assiciationType(name);
        // If this association refers to another single object type
        if (type === 'Entity' || type === 'Union') {
          // Find the entity name of the association, since name may not use same string as entity name
          var assocSchemaName = findKey(normalizrSchema, obj => obj === associations[name]);
          associationNamesToEntityNames[name] = assocSchemaName;
        } else if (type === 'Array') {
          // Find assocSchemaArrayName since name may not use same string as entities name
          var assocSchemaArrayName = associations[name][0]._key;
          associationNamesToEntityNames[name] = assocSchemaArrayName;
        } // Ignoring objects or other schema types
      });
  
      var associationNames = Object.keys(associations || {});

      entityClasses[entityName] = class extends EntityBase {
        #state;
        #attr;

        constructor(state, attrs) {
          super();
          this.#state = state;
          this.#attr = attrs;

          for (const key of Object.keys(attrs)) {
            // set the modified id names for the keys
            if (associationNames.includes(key)) {
              const type = assiciationType(key);
              if (type === 'Entity' || type === 'Union') {
                this[key + 'Id'] = attrs[key];
              } else if (type === 'Array') {
                this[key + 'Ids'] = attrs[key];
              } else {
                console.error(`unknown key type: ${key}`);
              }
            } else {
              this[key] = attrs[key];
            }
          }
        }

        getEntityName() {
          return entityName;
        }

        getState() {
          return this.#state;
        }

        getAttr() {
          return this.#attr;
        }
      } 

      associationNames.forEach(function (name) {
        function selectObject() {
          const attribute = this.getAttr()[name]
          if (get(attribute,'schema') && attribute.id) {
            return selectors[attribute.schema](this.getState(), attribute.id, true); //undefinedIsEmpty is true
          }
          if (selectors[associationNamesToEntityNames[name]] != null) {
            return selectors[associationNamesToEntityNames[name]](this.getState(), attribute, true); //undefinedIsEmpty is true
          }
          return null
        }
        entityClasses[entityName].prototype[name] = selectObject;
      });

      selectors[entityName] = function (state, id) {
        // Check existance
        if (!state[reduxStore][entityTableName] || !state[reduxStore][entityTableName][id]) {
          return null;
        }
        return new entityClasses[entityName](state, state[reduxStore][entityTableName][id]);
      };
  
      selectors[entityTableName] = function (state, idArray, undefinedIsEmpty = false) {
        // Check params
        if (!state[reduxStore][entityTableName]) {
          return [];
        }
        if (idArray == null) {
          idArray = undefinedIsEmpty ? [] : keys(state[reduxStore][entityTableName]);
        }
        // Return array of selected objects, must pass in an array or will select everything from state
        return compact(idArray.map(id => selectors[entityName](state, id)));
      };
    }
  });

  const PropTypes = mapValues(entityClasses, (klass, entityName) => {
    return (props, propName, componentName) => {
      const entity = get(props, propName)
      if (entity != null) {
        const entityNameToUse = klass.getEntityType ? klass.getEntityType(entity) : entityName;
        const getEntityName = get(entity, 'getEntityName');
        if (!isFunction(getEntityName) || getEntityName() !== entityNameToUse) {
          return new Error('Invalid prop `' + propName + '` supplied to `' + componentName + '`, expected `'+ entityName + '`. Validation failed.');
        }
      }
      return undefined;
    };
  });
  return { Selectors: selectors, Classes: entityClasses, PropTypes: PropTypes };
}
