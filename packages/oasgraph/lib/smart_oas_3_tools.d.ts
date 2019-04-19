import { Oas3, LinkObject } from './types/oas3.js';
import { ParameterValueTypes, LabeledOas3, SmartLinksObject } from './types/smart_oas3';
import { PreprocessingData } from './types/preprocessing_data';
/**
 * Label a list of OAS schemas by `info.title`
 *  for cross-schema referencing with `operationRef`.
 *
 * @param oass A list of OAS schemas
 * @returns A labeled list of OAS schemas
 */
export declare function getLabeledOass(oass: Oas3[]): LabeledOas3;
/**
 * Obtain groups of common `x-parameterValueType` parameters
 *  and their associated operations in each labeled OAS schema.
 *
 * @param labeledOass A list of labeled OAS schemas
 * @returns A dictionary with `x-parameterValueType` keys and
 *  pointers for obtaining the request and parameter.
 */
export declare function getParameterValueTypes(labeledOass: LabeledOas3): ParameterValueTypes;
/**
 * For a given OAS schema, obtain the smart-links
 *  (basically the same as `Oas3.getEndpointLinks(...)`
 *   but for `x-links` instead of `links`)
 */
export declare function getEndpointSmartLinks(path: string, method: string, oas: Oas3, data: PreprocessingData): SmartLinksObject;
/**
 * Given smart links, generate regular links out of them
 *  by matching a semantics with existing ParameterValueTypes.
 *
 * @param smartLinks The Smart Links from `getEndpointSmartLinks`
 * @param parameterValueTypes The output of `getParameterValueTypes`
 * @param oas The current OAS being processed
 * @param labeledOass The output of `getLabeledOass`
 */
export declare function generateLinksFromSmartLinks(smartLinks: SmartLinksObject, parameterValueTypes: ParameterValueTypes, oas: Oas3, labeledOass: LabeledOas3): {
    [key: string]: LinkObject;
};
