import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViajeActivoConductor } from './viaje-activo-conductor';

describe('ViajeActivoConductor', () => {
  let component: ViajeActivoConductor;
  let fixture: ComponentFixture<ViajeActivoConductor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViajeActivoConductor],
    }).compileComponents();

    fixture = TestBed.createComponent(ViajeActivoConductor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
