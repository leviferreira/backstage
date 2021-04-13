/*
 * Copyright 2021 Spotify AB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  Entity,
  RELATION_DEPENDS_ON,
  RELATION_PROVIDES_API,
  RELATION_PART_OF,
  serializeEntityRef,
} from '@backstage/catalog-model';
import {
  catalogApiRef,
  getEntityRelations,
  useEntity,
} from '@backstage/plugin-catalog-react';
import {
  DependencyGraph,
  DependencyGraphTypes,
  InfoCard,
  Progress,
  useApi,
  ResponseErrorPanel,
} from '@backstage/core';
import { Box, Typography } from '@material-ui/core';
import ZoomOutMap from '@material-ui/icons/ZoomOutMap';
import React from 'react';
import { useAsync } from 'react-use';

function simplifiedEntityName(
  ref:
    | Entity
    | {
        kind?: string;
        namespace?: string;
        name: string;
      },
): string {
  // Simplify the diagram output by hiding only the default namespace
  return serializeEntityRef(ref)
    .toString()
    .toLocaleLowerCase('en-US')
    .replace(':default/', ':');
}

/**
 * Dynamically generates a diagram of a system, its assigned entities,
 * and relationships of those entities.
 */
export function SystemDiagramCard() {
  const { entity } = useEntity();
  const currentSystemName = entity.metadata.name;
  const currentSystemNode = simplifiedEntityName(entity);
  const systemNodes = new Array<{ id: string }>();
  const systemEdges = new Array<{ from: string; to: string; label: string }>();

  const catalogApi = useApi(catalogApiRef);
  const { loading, error, value: catalogResponse } = useAsync(() => {
    return catalogApi.getEntities({
      filter: {
        kind: ['Component', 'API', 'Resource', 'System', 'Domain'],
        'spec.system': currentSystemName,
      },
    });
  }, [catalogApi, currentSystemName]);

  // pick out the system itself
  systemNodes.push({
    id: currentSystemNode,
  });

  // check if the system has an assigned domain
  // even if the domain object doesn't exist in the catalog, display it in the map
  const catalogItemDomain = getEntityRelations(entity, RELATION_PART_OF, {
    kind: 'domain',
  });
  catalogItemDomain.forEach(foundDomain =>
    systemNodes.push({
      id: simplifiedEntityName(foundDomain),
    }),
  );
  catalogItemDomain.forEach(foundDomain =>
    systemEdges.push({
      from: currentSystemNode,
      to: simplifiedEntityName(foundDomain),
      label: 'part of',
    }),
  );

  if (catalogResponse && catalogResponse.items) {
    for (const catalogItem of catalogResponse.items) {
      systemNodes.push({
        id: simplifiedEntityName(catalogItem),
      });

      // Check relations of the entity assigned to this system to see
      // if it relates to other entities.
      // Note those relations may, or may not, be explicitly
      // assigned to the system.
      const catalogItemRelations_partOf = getEntityRelations(
        catalogItem,
        RELATION_PART_OF,
      );
      catalogItemRelations_partOf.forEach(foundRelation =>
        systemEdges.push({
          from: simplifiedEntityName(catalogItem),
          to: simplifiedEntityName(foundRelation),
          label: 'part of',
        }),
      );

      const catalogItemRelations_providesApi = getEntityRelations(
        catalogItem,
        RELATION_PROVIDES_API,
      );
      catalogItemRelations_providesApi.forEach(foundRelation =>
        systemEdges.push({
          from: simplifiedEntityName(catalogItem),
          to: simplifiedEntityName(foundRelation),
          label: 'provides API',
        }),
      );

      const catalogItemRelations_dependsOn = getEntityRelations(
        catalogItem,
        RELATION_DEPENDS_ON,
      );
      catalogItemRelations_dependsOn.forEach(foundRelation =>
        systemEdges.push({
          from: simplifiedEntityName(catalogItem),
          to: simplifiedEntityName(foundRelation),
          label: 'depends on',
        }),
      );
    }
  }

  if (loading) {
    return <Progress />;
  } else if (error) {
    return <ResponseErrorPanel error={error} />;
  }

  return (
    <InfoCard title="System Diagram">
      <DependencyGraph
        nodes={systemNodes}
        edges={systemEdges}
        nodeMargin={10}
        direction={DependencyGraphTypes.Direction.BOTTOM_TOP}
      />
      <Box m={1} />
      <Typography
        variant="caption"
        style={{ display: 'block', textAlign: 'right' }}
      >
        <ZoomOutMap style={{ verticalAlign: 'bottom' }} /> Use pinch &amp; zoom
        to move around the diagram.
      </Typography>
    </InfoCard>
  );
}
