import * as Oas3Tools from './oas_3_tools'
import {
  Oas3,
  OperationObject,
  ResponsesObject,
  ResponseObject,
  ReferenceObject,
  LinksObject,
  LinkObject,
  ParameterObject,
} from './types/oas3.js'
import {
  ParameterValueTypes,
  SmartParameterObject,
  SmartLinkObject,
  LabeledOas3,
  SmartLinksObject,
  SmartResponseObject,
} from './types/smart_oas3';
import { PreprocessingData } from './types/preprocessing_data'

/**
 * Label a list of OAS schemas by `info.title`
 *  for cross-schema referencing with `operationRef`.
 * 
 * @param oass A list of OAS schemas
 * @returns A labeled list of OAS schemas
 */
export function getLabeledOass(
  oass: Oas3[]
): LabeledOas3 {
  let labeledOass = {}

  oass.forEach(oas => {
    let schema = oas.info.title
    if (typeof schema === 'undefined') {
      console.warn('schema titles are required for linking')
      return
    }
    labeledOass[schema] = oas
  })

  return labeledOass
}

/**
 * Obtain groups of common `x-parameterValueType` parameters
 *  and their associated operations in each labeled OAS schema.
 * 
 * @param labeledOass A list of labeled OAS schemas
 * @returns A dictionary with `x-parameterValueType` keys and
 *  pointers for obtaining the request and parameter.
 */
export function getParameterValueTypes(
  labeledOass: LabeledOas3
): ParameterValueTypes {
  let parameterValueTypes: ParameterValueTypes = {}

  Object.keys(labeledOass).forEach(schema => {
    let oas = labeledOass[schema]

    for (let path in oas.paths) {
      for (let method in oas.paths[path]) {
        //  Only consider Operation Objects
        if (!Oas3Tools.isOperation(method)) {
          continue
        }

        // Parameters
        let parameters: SmartParameterObject[] = Oas3Tools.getParameters(path, method, oas)

        for (let parameter of parameters) {
          let name: string = parameter.name
          let parameterValueType: string = parameter['x-parameterValueType']
          if (typeof parameterValueType === 'undefined') {
            continue
          }
          if (typeof name === 'undefined') {
            console.warn(`parameter in ${schema}#/paths/${path}/${method} does not have name`)
            continue
          }
          if (typeof parameterValueTypes[parameterValueType] === 'undefined') {
            parameterValueTypes[parameterValueType] = []
          }
          parameterValueTypes[parameterValueType].push({
            schema,
            path,
            method,
            name,
          })
        }
      }
    }
  })

  return parameterValueTypes
}

/**
 * For a given OAS schema, obtain the smart-links
 *  (basically the same as `Oas3.getEndpointLinks(...)`
 *   but for `x-links` instead of `links`)
 */
export function getEndpointSmartLinks (
  path: string,
  method: string,
  oas: Oas3,
  data: PreprocessingData,
): SmartLinksObject {
  let links = {}
  let endpoint: OperationObject = oas.paths[path][method]
  let statusCode = Oas3Tools.getResponseStatusCode(path, method, oas, data)
  if (!statusCode) {
    return links
  }
  if (typeof endpoint.responses === 'object') {
    let responses: ResponsesObject = endpoint.responses
    if (typeof responses[statusCode] === 'object') {
      let response: ResponseObject | ReferenceObject = responses[statusCode]

      if (typeof (response as ReferenceObject).$ref === 'string') {
        response = (Oas3Tools.resolveRef((response as ReferenceObject).$ref, oas) as ResponseObject)
      }

      // here, we can be certain we have a ResponseObject:
      response = ((response as any) as ResponseObject)

      if (typeof response['x-links'] === 'object') {
        let epLinks: LinksObject = response['x-links']
        for (let linkKey in epLinks) {
          let link: LinkObject | ReferenceObject = epLinks[linkKey]

          // make sure we have LinkObjects:
          if (typeof (link as ReferenceObject).$ref === 'string') {
            link = Oas3Tools.resolveRef(link['$ref'], oas)
          } else {
            link = ((link as any) as SmartLinkObject)
          }
          links[linkKey] = link
        }
      }
    }
  }
  return links
}

/**
 * Given smart links, generate regular links out of them
 *  by matching a semantics with existing ParameterValueTypes.
 * 
 * @param smartLinks The Smart Links from `getEndpointSmartLinks`
 * @param parameterValueTypes The output of `getParameterValueTypes`
 * @param oas The current OAS being processed
 * @param labeledOass The output of `getLabeledOass`
 */
export function generateLinksFromSmartLinks (
  smartLinks: SmartLinksObject,
  parameterValueTypes: ParameterValueTypes,
  oas: Oas3,
  labeledOass: LabeledOas3,
): {
  [key: string]: LinkObject
} {
  let schema = oas.info.title
  
  let links: {
    [key: string]: LinkObject
  } = {}
  let linkOps: {
    [key: string]: OperationObject
  } = {}
  
  // Step 1: Establish link objects for all parameterValueType matches
  for (let smartLinkKey in smartLinks) {
    let smartLink = smartLinks[smartLinkKey]
    for (let smartLinkParameterKey in smartLink.parameters) {
      // Get parameterValueTypes which match the smartLink parameters
      //  and therefore can be potentially linked.
      let smartLinkParameterMatches = parameterValueTypes[smartLinkParameterKey]
      let smartLinkParameterValue = smartLink.parameters[smartLinkParameterKey]

      if (typeof smartLinkParameterMatches === 'undefined') {
        continue
      }
      
      // Create a link for each match
      smartLinkParameterMatches.forEach(smartLinkParameterMatch => {
        let linkKey = smartLinkKey
        let endpoint: OperationObject = labeledOass[smartLinkParameterMatch.schema].paths[smartLinkParameterMatch.path][smartLinkParameterMatch.method]
        let link = links[linkKey]
        
        // Ensure link valueType compatibility
        if (typeof smartLink["x-valueType"] !== 'undefined') {
          let good = false
          for (let response_key in endpoint.responses) {
            let response = endpoint.responses[response_key]
            if (typeof (response as ReferenceObject).$ref === 'string') {
              response = Oas3Tools.resolveRef((response as ReferenceObject).$ref, oas) as SmartResponseObject
            } else {
              response = (response as any) as SmartResponseObject
            }
            if (typeof response["x-responseValueType"] !== 'undefined') {
              if (response["x-responseValueType"] === smartLink["x-valueType"]) {
                good = true
              }
            }
          }
          if (good !== true) {
            return
          }
        }

        // Construct link object if it doesn't yet exist
        if (typeof link === 'undefined') {
          let operationRef = `${smartLinkParameterMatch.schema !== schema ? smartLinkParameterMatch.schema : ''}#/paths/${smartLinkParameterMatch.path.replace(/\//g, '~1')}/${smartLinkParameterMatch.method}`
          links[linkKey] = {
            ...smartLink,
            operationRef,
            parameters: {}
          }
          // Save the path for the given linkKey
          linkOps[linkKey] = endpoint
        }

        // Parameter to link object
        links[linkKey].parameters[smartLinkParameterMatch.name] = smartLinkParameterValue
      })
    }
  }

  // Step 2: Remove any link objects which would result in an incomplete API call
  for (let linkKey in links) {
    let link = links[linkKey]
    let endpoint = linkOps[linkKey]
    let defined_params = new Set(Object.keys(link.parameters))
    let good = true

    endpoint.parameters.forEach((parameter) => {
      if (typeof (parameter as ReferenceObject).$ref === 'string') {
        parameter = Oas3Tools.resolveRef((parameter as ReferenceObject).$ref, oas) as ParameterObject
      } else {
        parameter = (parameter as any) as ParameterObject
      }
      if (parameter.required && !defined_params.has(parameter.name)) {
        good = false
        console.warn(`Link: ${linkKey}: ${JSON.stringify(link)} could not be established due to missing parameter ${parameter.name}`)
        return
      }
    })

    if (good !== true) {
      delete links[linkKey]
    }
  }

  return links
}
