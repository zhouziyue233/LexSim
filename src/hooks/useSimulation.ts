import { useCallback, useMemo, useReducer, useRef } from 'react'
import type { Dispatch } from 'react'
import type {
  Simulation,
  SimulationStage,
  SimulationState,
  LegalEntity,
  RelationshipGraph,
  GameplayEvent,
  PredictionReport,
  TrialPhase,
  JudgeDirective,
} from '@shared/types'
import type { EdgeChange } from '../lib/api'
import { DEFAULT_SIMULATION_ROUNDS } from '@shared/constants'
import {
  createSimulation,
  getSimulation,
  resumeSimulation as resumeSimulationRequest,
  subscribeToSimulation,
} from '../lib/api'

type Action =
  | { type: 'SET_CASE_INPUT'; payload: string }
  | { type: 'SET_ROUND_COUNT'; payload: number }
  | { type: 'SET_SIMULATION_ID'; payload: string }
  | { type: 'HYDRATE'; payload: Simulation }
  | { type: 'START_STAGE'; payload: SimulationStage }
  | { type: 'STAGE_CHUNK'; payload: { stage: SimulationStage; text: string } }
  | { type: 'STAGE_COMPLETE'; payload: SimulationStage }
  | { type: 'STAGE_ERROR'; payload: { stage: SimulationStage; error: string } }
  | { type: 'ENTITIES_DONE'; payload: LegalEntity[] }
  | { type: 'GRAPH_DONE'; payload: RelationshipGraph }
  | { type: 'APPEND_EVENT'; payload: { event: GameplayEvent; prob: number; sentiment: number } }
  | { type: 'REPORT_DONE'; payload: PredictionReport }
  | { type: 'ROUND_START'; payload: { phase?: TrialPhase; directives?: JudgeDirective[] } }
  | { type: 'GRAPH_UPDATE'; payload: EdgeChange[] }
  | { type: 'CASE_SUMMARY'; payload: string }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'RESET' }

const initialState: SimulationState = {
  simulationId: null,
  stage: 0,
  stageStatuses: { 0: 'idle', 1: 'idle', 2: 'idle', 3: 'idle', 4: 'idle' },
  caseInput: '',
  caseSummary: '',
  roundCount: DEFAULT_SIMULATION_ROUNDS,
  entities: [],
  graph: null,
  timeline: null,
  report: null,
  streamingText: '',
  error: null,
  currentPhase: null,
  activeDirectives: [],
}

function reducer(state: SimulationState, action: Action): SimulationState {
  switch (action.type) {
    case 'SET_CASE_INPUT':
      return { ...state, caseInput: action.payload }

    case 'SET_ROUND_COUNT':
      return { ...state, roundCount: action.payload }

    case 'SET_SIMULATION_ID':
      return { ...state, simulationId: action.payload }

    case 'HYDRATE':
      return {
        simulationId: action.payload.id,
        stage: action.payload.stage,
        stageStatuses: action.payload.stageStatuses,
        caseInput: action.payload.caseInput,
        caseSummary: action.payload.caseSummary ?? '',
        roundCount: action.payload.roundCount,
        entities: action.payload.entities,
        graph: action.payload.graph,
        timeline: action.payload.timeline,
        report: action.payload.report,
        streamingText: '',
        error: action.payload.error,
        currentPhase: null,
        activeDirectives: [],
      }

    case 'START_STAGE':
      return {
        ...state,
        stage: action.payload,
        streamingText: '',
        error: null,
        stageStatuses: {
          ...state.stageStatuses,
          [action.payload]: 'loading',
        },
      }

    case 'STAGE_CHUNK':
      if (state.stage !== action.payload.stage) {
        return {
          ...state,
          stage: action.payload.stage,
          streamingText: action.payload.text,
          stageStatuses: {
            ...state.stageStatuses,
            [action.payload.stage]: 'loading',
          },
        }
      }

      return { ...state, streamingText: state.streamingText + action.payload.text }

    case 'STAGE_COMPLETE':
      return {
        ...state,
        stage: action.payload,
        streamingText: '',
        stageStatuses: {
          ...state.stageStatuses,
          [action.payload]: 'done',
        },
      }

    case 'STAGE_ERROR':
      return {
        ...state,
        stage: action.payload.stage,
        error: action.payload.error,
        stageStatuses: {
          ...state.stageStatuses,
          [action.payload.stage]: 'error',
        },
      }

    case 'ENTITIES_DONE':
      return {
        ...state,
        entities: action.payload,
        stageStatuses: { ...state.stageStatuses, 1: 'done' },
      }

    case 'GRAPH_DONE':
      return {
        ...state,
        graph: action.payload,
        stageStatuses: { ...state.stageStatuses, 2: 'done' },
      }

    case 'APPEND_EVENT': {
      const prev = state.timeline ?? {
        events: [],
        currentPlaintiffWinProb: 50,
        socialInfluenceScore: 0,
      }

      return {
        ...state,
        timeline: {
          events: [...prev.events, action.payload.event],
          currentPlaintiffWinProb: action.payload.prob,
          socialInfluenceScore: action.payload.sentiment,
        },
      }
    }

    case 'REPORT_DONE':
      return {
        ...state,
        report: action.payload,
        streamingText: '',
        stage: 4,
        stageStatuses: { ...state.stageStatuses, 4: 'done' },
      }

    case 'ROUND_START':
      return {
        ...state,
        currentPhase: action.payload.phase ?? state.currentPhase,
        activeDirectives: action.payload.directives ?? state.activeDirectives,
      }

    case 'GRAPH_UPDATE': {
      if (!state.graph) return state
      const updatedEdges = [...state.graph.edges]
      for (const change of action.payload) {
        if (change.action === 'add') {
          updatedEdges.push(change.edge)
        } else if (change.action === 'update') {
          const idx = updatedEdges.findIndex(e => e.id === change.edge.id)
          if (idx >= 0) updatedEdges[idx] = change.edge
        } else if (change.action === 'remove') {
          const idx = updatedEdges.findIndex(e => e.id === change.edge.id)
          if (idx >= 0) updatedEdges.splice(idx, 1)
        }
      }
      return {
        ...state,
        graph: { ...state.graph, edges: updatedEdges },
      }
    }

    case 'CASE_SUMMARY':
      return { ...state, caseSummary: action.payload }

    case 'SET_ERROR':
      return { ...state, error: action.payload }

    case 'RESET':
      return { ...initialState }

    default:
      return state
  }
}

function createSimulationHandlers(dispatch: Dispatch<Action>) {
  return {
    onStageStart: (stage: SimulationStage) =>
      dispatch({ type: 'START_STAGE', payload: stage }),

    onStageChunk: (stage: SimulationStage, text: string) =>
      dispatch({ type: 'STAGE_CHUNK', payload: { stage, text } }),

    onStageComplete: (stage: SimulationStage) =>
      dispatch({ type: 'STAGE_COMPLETE', payload: stage }),

    onStageError: (stage: SimulationStage, error: string) =>
      dispatch({ type: 'STAGE_ERROR', payload: { stage, error } }),

    onCaseSummary: (summary: string) =>
      dispatch({ type: 'CASE_SUMMARY', payload: summary }),

    onEntities: (entities: LegalEntity[]) =>
      dispatch({ type: 'ENTITIES_DONE', payload: entities }),

    onGraph: (graph: RelationshipGraph) =>
      dispatch({ type: 'GRAPH_DONE', payload: graph }),

    onRoundStart: (_round: number, _activeAgents: string[], phase?: TrialPhase, directives?: JudgeDirective[]) =>
      dispatch({ type: 'ROUND_START', payload: { phase, directives } }),

    onGraphUpdate: (_round: number, changes: EdgeChange[]) =>
      dispatch({ type: 'GRAPH_UPDATE', payload: changes }),

    onEventResolved: (event: GameplayEvent, prob: number, sentiment: number) =>
      dispatch({ type: 'APPEND_EVENT', payload: { event, prob, sentiment } }),

    onReportChunk: (text: string) =>
      dispatch({ type: 'STAGE_CHUNK', payload: { stage: 4, text } }),

    onReportComplete: (report: PredictionReport) =>
      dispatch({ type: 'REPORT_DONE', payload: report }),

    onError: (error: string) =>
      dispatch({ type: 'SET_ERROR', payload: error }),
  }
}

export function useSimulation() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const unsubRef = useRef<(() => void) | null>(null)
  const handlers = useMemo(() => createSimulationHandlers(dispatch), [dispatch])

  const detach = useCallback(() => {
    unsubRef.current?.()
    unsubRef.current = null
  }, [])

  const attachToSimulation = useCallback((simulationId: string) => {
    detach()
    unsubRef.current = subscribeToSimulation(simulationId, handlers)
  }, [detach, handlers])

  const loadSimulation = useCallback(async (simulationId: string) => {
    const simulation = await getSimulation(simulationId)
    dispatch({ type: 'HYDRATE', payload: simulation })

    if (simulation.status === 'running') {
      attachToSimulation(simulationId)
    } else {
      detach()
    }

    return simulation
  }, [attachToSimulation, detach])

  const runSimulation = useCallback(async (caseInput: string, roundCount: number, fileContent?: string, fileName?: string, projectName?: string) => {
    dispatch({ type: 'RESET' })
    dispatch({ type: 'SET_CASE_INPUT', payload: caseInput })
    dispatch({ type: 'SET_ROUND_COUNT', payload: roundCount })

    try {
      const simulationId = await createSimulation({ caseInput, roundCount, fileContent, fileName, projectName })
      dispatch({ type: 'SET_SIMULATION_ID', payload: simulationId })
      attachToSimulation(simulationId)
      return simulationId
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: String(err) })
      throw err
    }
  }, [attachToSimulation])

  const resumeSimulation = useCallback(async (simulationId: string) => {
    attachToSimulation(simulationId)
    try {
      await resumeSimulationRequest(simulationId)
      await loadSimulation(simulationId)
    } catch (err) {
      detach()
      dispatch({ type: 'SET_ERROR', payload: String(err) })
      throw err
    }
  }, [attachToSimulation, detach, loadSimulation])

  const reset = useCallback(() => {
    detach()
    dispatch({ type: 'RESET' })
  }, [detach])

  const setRoundCount = useCallback((roundCount: number) => {
    dispatch({ type: 'SET_ROUND_COUNT', payload: roundCount })
  }, [])

  return {
    state,
    runSimulation,
    loadSimulation,
    resumeSimulation,
    reset,
    detach,
    setRoundCount,
  }
}
