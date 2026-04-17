import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";
import { VRMHumanBoneName } from "@pixiv/three-vrm-core";

function quatFromEuler(
  x: number,
  y: number,
  z: number,
  order: THREE.EulerOrder = "XYZ",
): [number, number, number, number] {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, order));
  return [q.x, q.y, q.z, q.w];
}

/**
 * VRM rest is usually T-pose. Apply a relaxed standing pose (arms clearly down).
 * Call each frame after {@link VRM.update} so node constraints (e.g. Pixiv sample)
 * cannot snap arms back to T-pose.
 */
export function applyVrmRelaxedArmsPose(vrm: VRM): void {
  const h = vrm.humanoid;
  if (!h) return;

  const pose = h.getNormalizedPose();

  const lu = quatFromEuler(0.52, 0.06, 1.02, "XYZ");
  const ru = quatFromEuler(0.52, -0.06, -1.02, "XYZ");
  const ll = quatFromEuler(-0.62, 0, 0, "XYZ");
  const rl = quatFromEuler(-0.62, 0, 0, "XYZ");
  const ls = quatFromEuler(0.1, 0.02, 0.14, "XYZ");
  const rs = quatFromEuler(0.1, -0.02, -0.14, "XYZ");

  pose[VRMHumanBoneName.LeftShoulder] = {
    ...pose[VRMHumanBoneName.LeftShoulder],
    rotation: ls,
  };
  pose[VRMHumanBoneName.RightShoulder] = {
    ...pose[VRMHumanBoneName.RightShoulder],
    rotation: rs,
  };
  pose[VRMHumanBoneName.LeftUpperArm] = {
    ...pose[VRMHumanBoneName.LeftUpperArm],
    rotation: lu,
  };
  pose[VRMHumanBoneName.RightUpperArm] = {
    ...pose[VRMHumanBoneName.RightUpperArm],
    rotation: ru,
  };
  pose[VRMHumanBoneName.LeftLowerArm] = {
    ...pose[VRMHumanBoneName.LeftLowerArm],
    rotation: ll,
  };
  pose[VRMHumanBoneName.RightLowerArm] = {
    ...pose[VRMHumanBoneName.RightLowerArm],
    rotation: rl,
  };

  h.setNormalizedPose(pose);
}
